import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

const COLLECTIONS = {
  players: 'smashVersePlayers',
  seasons: 'smashVerseSeasons',
  matches: 'smashVerseMatches',
}
const ADMIN_LOGIN_KEY = 'smashVerseAdminLoggedIn'
const MATCH_POINT_LIMITS = { 11: 15, 15: 20, 21: 30 }

function getMatchPoints(matchPoints) {
  const points = Number(matchPoints)
  return MATCH_POINT_LIMITS[points] ? points : 21
}

function getMatchWinner(score1, score2, matchPoints) {
  const target = getMatchPoints(matchPoints)
  const limit = MATCH_POINT_LIMITS[target]
  const highScore = Math.max(score1, score2)
  const lead = Math.abs(score1 - score2)

  if (highScore >= limit) return score1 > score2 ? 1 : 2
  if (highScore >= target && lead >= 2) return score1 > score2 ? 1 : 2
  return null
}

function getMatchScoreState(score1, score2, matchPoints) {
  const target = getMatchPoints(matchPoints)
  const highScore = Math.max(score1, score2)
  const lead = Math.abs(score1 - score2)

  if (score1 === score2 && score1 >= target - 1) return { type: 'deuce' }
  if (highScore >= target && highScore < MATCH_POINT_LIMITS[target] && lead === 1) {
    return { type: 'advantage', player: score1 > score2 ? 1 : 2 }
  }
  return null
}

function Icon({ name }) {
  const icons = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4" /></>,
    players: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20a6 6 0 0 1 12 0M14 16a5 5 0 0 1 7 4" /></>,
    admin: <><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" /><path d="M9 12h6M10 9h4v6h-4z" /></>,
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true">{icons[name]}</svg>
}

function usePublicData() {
  const [data, setData] = useState({ players: [], seasons: [], matches: [] })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(collection(db, COLLECTIONS.players), (snapshot) => {
        setErrors((current) => ({ ...current, players: '' }))
        setData((current) => ({ ...current, players: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) }))
      }, (snapshotError) => setErrors((current) => ({ ...current, players: snapshotError.message }))),
      onSnapshot(collection(db, COLLECTIONS.seasons), (snapshot) => {
        setErrors((current) => ({ ...current, seasons: '' }))
        setData((current) => ({ ...current, seasons: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) }))
      }, (snapshotError) => setErrors((current) => ({ ...current, seasons: snapshotError.message }))),
      onSnapshot(collection(db, COLLECTIONS.matches), (snapshot) => {
        setErrors((current) => ({ ...current, matches: '' }))
        setData((current) => ({ ...current, matches: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) }))
      }, (snapshotError) => setErrors((current) => ({ ...current, matches: snapshotError.message }))),
    ]

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [])

  return { ...data, error: Object.values(errors).find(Boolean) || '' }
}

function LiveMatch({ match, players, matchesCount }) {
  const playerOne = players.find((player) => player.id === match?.player1Id)
  const playerTwo = players.find((player) => player.id === match?.player2Id)

  if (!match) {
    return (
      <article className="live-match no-live-match">
        <p className="eyebrow">LIVE MATCH</p>
        <h2>No live matches</h2>
        <p>Check back when the next match begins.</p>
      </article>
    )
  }

  return (
    <article className="live-match">
      <div className="live-heading">
        <span className="live-pill"><i /> LIVE</span>
        <span>{match.round || 'Match'}</span>
      </div>
      <div className="scoreboard">
        <div className="player">
          <div className="player-avatar blue">{(playerOne?.name || match.player1Name || 'P1').slice(0, 2).toUpperCase()}</div>
          <div><strong>{playerOne?.name || match.player1Name || 'Player 1'}</strong><span>{playerOne?.country || 'Player'}</span></div>
        </div>
        <strong className="public-score">{match.score1 ?? 0}</strong>
        <span className="score-divider">:</span>
        <strong className="public-score">{match.score2 ?? 0}</strong>
        <div className="player player-right">
          <div><strong>{playerTwo?.name || match.player2Name || 'Player 2'}</strong><span>{playerTwo?.country || 'Player'}</span></div>
          <div className="player-avatar coral">{(playerTwo?.name || match.player2Name || 'P2').slice(0, 2).toUpperCase()}</div>
        </div>
      </div>
      <div className="match-footer"><span>Live score</span><span>{matchesCount} matches recorded</span></div>
    </article>
  )
}

function SeasonCards({ seasons, matches }) {
  if (seasons.length === 0) {
    return <div className="empty-state">No seasons have been created yet.</div>
  }

  return (
    <div className="public-season-list">
      {seasons.map((season) => {
        const seasonMatches = matches.filter((match) => match.seasonId === season.id)
        const seasonDates = [season.startDate, season.endDate].filter(Boolean).join(' to ')

        return (
          <article className="public-season-card" key={season.id}>
            <header className="public-season-heading">
              <div>
                <p className="eyebrow">{season.format || 'Singles'}{season.isCurrent ? ' · CURRENT SEASON' : ''}</p>
                <h3>{season.name}</h3>
                {seasonDates && <span>{seasonDates}</span>}
              </div>
              <span className="public-season-count">{seasonMatches.length} {seasonMatches.length === 1 ? 'match' : 'matches'}</span>
            </header>
            {seasonMatches.length === 0 ? <p className="public-season-empty">No matches in this season yet.</p> : (
              <div className="public-season-matches">
                {seasonMatches.map((match) => (
                  <article className="public-season-match" key={match.id}>
                    <div>
                      <strong>{match.player1Name} vs {match.player2Name}</strong>
                      <span>{match.round} · {match.matchPoints ?? 21} points · {match.status}</span>
                      {match.winnerName && <span className="public-season-winner">Winner: {match.winnerName}</span>}
                    </div>
                    <strong className="public-season-score">{match.score1 ?? 0} : {match.score2 ?? 0}</strong>
                  </article>
                ))}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function PublicShell({ page, setPage, children }) {
  const navigation = [
    ['Dashboard', 'grid'],
    ['Seasons', 'trophy'],
    ['Players', 'players'],
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); setPage('Dashboard') }}>
          <div className="brand-mark" aria-hidden="true">SV</div>
          <div><strong>Smash Verse</strong><span>PRO</span></div>
        </a>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(([label, icon]) => (
            <button key={label} className={page === label ? 'active' : ''} onClick={() => setPage(label)} type="button">
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
          <a className="admin-link" href={`${import.meta.env.BASE_URL}?admin=1`}><Icon name="admin" /><span>Admin</span></a>
        </nav>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">SMASH VERSE PRO</p>
            <h1>{page}</h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}

function PublicPages({ page, players, seasons, matches, dataError }) {
  const currentSeason = seasons.find((season) => season.isCurrent)
  const seasonMatches = currentSeason ? matches.filter((match) => match.seasonId === currentSeason.id) : []
  const liveMatch = seasonMatches.find((match) => match.status === 'Live')
  const leaderboard = buildLeaderboard(players, seasonMatches)
  const standingsByPlayer = new Map(leaderboard.map((standing) => [standing.player.id, standing]))

  if (dataError) {
    return <div className="data-error" role="alert">Couldn’t load app data: {dataError}</div>
  }

  if (page === 'Seasons') {
    return (
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">SEASON HISTORY</p><h2>Seasons</h2></div></div>
        <SeasonCards seasons={seasons} matches={matches} />
      </section>
    )
  }

  if (page === 'Players') {
    return (
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">COMMUNITY · {currentSeason?.name || 'NO CURRENT SEASON'}</p><h2>Players</h2></div></div>
        {players.length === 0 ? <div className="empty-state">No players have been added yet.</div> : (
          <div className="player-grid">
            {players.map((player) => (
              <article className="public-player-card" key={player.id}>
                <div className="public-player-info">
                  <div className="leader-avatar">{player.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</div>
                  <div><strong>{player.name}</strong>{player.country && <span>{player.country}</span>}</div>
                </div>
                <div className="public-player-stats">
                  {[
                    ['P', standingsByPlayer.get(player.id)?.played ?? 0, 'Played'],
                    ['W', standingsByPlayer.get(player.id)?.won ?? 0, 'Won'],
                    ['L', standingsByPlayer.get(player.id)?.lost ?? 0, 'Lost'],
                    ['Pts', standingsByPlayer.get(player.id)?.points ?? 0, 'League points'],
                    ['GF', standingsByPlayer.get(player.id)?.gf ?? 0, 'Points for'],
                    ['GA', standingsByPlayer.get(player.id)?.ga ?? 0, 'Points against'],
                    ['Diff', (standingsByPlayer.get(player.id)?.gf ?? 0) - (standingsByPlayer.get(player.id)?.ga ?? 0), 'Point difference'],
                  ].map(([label, value, title]) => (
                    <div className="public-player-stat" key={label} title={title}>
                      <span>{label}</span><strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <>
      <section className="hero-row">
        <LiveMatch match={liveMatch} players={players} matchesCount={seasonMatches.length} />
        <article className="quick-stats">
          <div><span>Active matches</span><strong>{seasonMatches.filter((match) => match.status === 'Live').length}</strong><small>Live now</small></div>
          <div><span>Registered players</span><strong>{players.length}</strong><small>In the community</small></div>
        </article>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">SEASON OVERVIEW</p><h2>Seasons</h2></div></div>
        <SeasonCards seasons={seasons} matches={matches} />
      </section>
      <section className="leaderboard">
        <div className="section-heading"><div><p className="eyebrow">STANDINGS · {currentSeason?.name || 'NO CURRENT SEASON'}</p><h2>Player leaderboard</h2></div></div>
        {leaderboard.length === 0 ? <div className="empty-state">Player rankings will appear here.</div> : (
          <div className="standings-scroll">
            <table className="standings-table" aria-label="Current season player standings">
              <thead><tr>
                <th scope="col">#</th>
                <th scope="col">Player</th>
                <th scope="col" title="Played">P</th>
                <th scope="col" title="Won">W</th>
                <th scope="col" title="Lost">L</th>
                <th scope="col" title="League Points">Pts</th>
                <th scope="col" title="Points For">GF</th>
                <th scope="col" title="Points Against">GA</th>
                <th scope="col" title="Difference">Diff</th>
              </tr></thead>
              <tbody>
                {leaderboard.map((standing, index) => (
                  <tr key={standing.player.id}>
                    <td>{index + 1}</td>
                    <th scope="row">{standing.player.name}</th>
                    <td>{standing.played}</td>
                    <td>{standing.won}</td>
                    <td>{standing.lost}</td>
                    <td>{standing.points}</td>
                    <td>{standing.gf}</td>
                    <td>{standing.ga}</td>
                    <td>{standing.gf - standing.ga}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function buildLeaderboard(players, matches) {
  const standings = new Map(players.map((player) => [player.id, {
    player,
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
    gf: 0,
    ga: 0,
  }]))

  matches.filter((match) => match.status === 'Completed').forEach((match) => {
    const player1 = standings.get(match.player1Id)
    const player2 = standings.get(match.player2Id)
    if (!player1 || !player2) return

    const score1 = Math.max(0, Number(match.score1) || 0)
    const score2 = Math.max(0, Number(match.score2) || 0)
    player1.played += 1
    player2.played += 1
    player1.gf += score1
    player1.ga += score2
    player2.gf += score2
    player2.ga += score1

    const winnerId = [match.player1Id, match.player2Id].includes(match.winnerId)
      ? match.winnerId
      : score1 === score2 ? null : score1 > score2 ? match.player1Id : match.player2Id

    if (winnerId === match.player1Id) {
      player1.won += 1
      player1.points += 2
      player2.lost += 1
    } else if (winnerId === match.player2Id) {
      player2.won += 1
      player2.points += 2
      player1.lost += 1
    }
  })

  return [...standings.values()].sort((a, b) => (
    b.points - a.points
    || b.won - a.won
    || (b.gf - b.ga) - (a.gf - a.ga)
    || b.gf - a.gf
    || a.player.name.localeCompare(b.player.name)
  ))
}

function AdminDashboard({ players, seasons, matches, dataError, onLogout }) {
  const [adminSection, setAdminSection] = useState('home')
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [scoringMatchId, setScoringMatchId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const currentSeason = seasons.find((season) => season.isCurrent)
  const matchSeasonId = seasons.some((season) => season.id === selectedSeasonId)
    ? selectedSeasonId
    : currentSeason?.id || seasons[0]?.id || ''
  const selectedSeasonMatches = matches.filter((match) => match.seasonId === matchSeasonId)
  const currentSeasonMatches = currentSeason
    ? matches.filter((match) => match.seasonId === currentSeason.id)
    : []
  const scoringMatch = currentSeasonMatches.find((match) => match.id === scoringMatchId)
  const matchScoreState = scoringMatch?.status === 'Live'
    ? getMatchScoreState(Number(scoringMatch.score1) || 0, Number(scoringMatch.score2) || 0, scoringMatch.matchPoints)
    : null
  const sectionTitles = {
    seasons: 'Create season',
    players: 'Create players',
    matches: 'Create matches',
    scoring: 'Score current season',
  }

  const perform = async (operation, successMessage) => {
    setNotice('')
    setError('')
    setBusy(true)
    try {
      await operation()
      setNotice(successMessage)
      return true
    } catch (operationError) {
      setError(operationError.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const createSeason = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const name = String(values.get('name')).trim()
    const makeCurrent = values.get('makeCurrent') === 'on' || !currentSeason

    const created = await perform(async () => {
      const batch = writeBatch(db)
      if (makeCurrent) {
        seasons.filter((season) => season.isCurrent).forEach((season) => {
          batch.update(doc(db, COLLECTIONS.seasons, season.id), { isCurrent: false })
        })
      }
      const seasonRef = doc(collection(db, COLLECTIONS.seasons))
      batch.set(seasonRef, {
        name,
        format: String(values.get('format')),
        startDate: String(values.get('startDate')),
        endDate: String(values.get('endDate')),
        isCurrent: makeCurrent,
        createdAt: serverTimestamp(),
      })
      await batch.commit()
    }, 'Season created.')

    if (created) form.reset()
  }

  const makeCurrentSeason = (season) => perform(async () => {
    const batch = writeBatch(db)
    seasons.filter((item) => item.isCurrent && item.id !== season.id).forEach((item) => {
      batch.update(doc(db, COLLECTIONS.seasons, item.id), { isCurrent: false })
    })
    batch.update(doc(db, COLLECTIONS.seasons, season.id), { isCurrent: true })
    await batch.commit()
  }, `${season.name} is now the current season.`)

  const createPlayer = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const player = {
      name: String(values.get('name')).trim(),
      createdAt: serverTimestamp(),
    }
    if (await perform(() => addDoc(collection(db, COLLECTIONS.players), player), 'Player created.')) form.reset()
  }

  const createMatch = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const season = seasons.find((item) => item.id === values.get('seasonId'))
    const player1 = players.find((item) => item.id === values.get('player1Id'))
    const player2 = players.find((item) => item.id === values.get('player2Id'))
    if (!season || !player1 || !player2 || player1.id === player2.id) {
      setError('Choose a season and two different players.')
      return
    }

    const match = {
      seasonId: season.id,
      seasonName: season.name,
      player1Id: player1.id,
      player1Name: player1.name,
      player2Id: player2.id,
      player2Name: player2.name,
      round: String(values.get('round')).trim(),
      matchPoints: Number(values.get('matchPoints')),
      score1: 0,
      score2: 0,
      status: 'Live',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    if (await perform(() => addDoc(collection(db, COLLECTIONS.matches), match), 'Match created.')) form.reset()
  }

  const updateScore = (match, field) => perform(async () => {
    const matchRef = doc(db, COLLECTIONS.matches, match.id)
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(matchRef)
      if (!snapshot.exists() || snapshot.data().status !== 'Live' || snapshot.data().seasonId !== currentSeason?.id) {
        throw new Error('This match is no longer live in the current season.')
      }
      const matchData = snapshot.data()
      const score1 = Number(matchData.score1) || 0
      const score2 = Number(matchData.score2) || 0
      const nextScore1 = score1 + (field === 'score1' ? 1 : 0)
      const nextScore2 = score2 + (field === 'score2' ? 1 : 0)
      const winner = getMatchWinner(nextScore1, nextScore2, Number(matchData.matchPoints) || 21)
      const update = {
        score1: nextScore1,
        score2: nextScore2,
        updatedAt: serverTimestamp(),
      }

      if (winner) {
        update.status = 'Completed'
        update.winnerId = winner === 1 ? matchData.player1Id : matchData.player2Id
        update.winnerName = winner === 1 ? matchData.player1Name : matchData.player2Name
      }

      transaction.update(matchRef, update)
    })
  }, 'Score updated.')

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="eyebrow">SMASH VERSE PRO</p>
          <h1>{adminSection === 'home' ? 'Admin' : sectionTitles[adminSection]}</h1>
          {adminSection === 'home' && <span>Choose an admin task</span>}
        </div>
        <div className="admin-header-actions">
          {adminSection !== 'home' && <button className="admin-back-button" onClick={() => setAdminSection('home')} type="button">← Admin menu</button>}
          <button className="admin-logout-button" onClick={onLogout} type="button">Log out as admin</button>
        </div>
      </header>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {dataError && <p className="data-error" role="alert">Couldn’t load Firestore data: {dataError}</p>}

      {adminSection === 'home' && (
        <div className="admin-menu-grid">
          <button className="admin-menu-card" onClick={() => setAdminSection('seasons')} type="button">
            <span className="admin-menu-number">01</span><strong>Create season</strong><span>{seasons.length} seasons</span>
          </button>
          <button className="admin-menu-card" onClick={() => setAdminSection('players')} type="button">
            <span className="admin-menu-number">02</span><strong>Create players</strong><span>{players.length} players</span>
          </button>
          <button className="admin-menu-card" onClick={() => setAdminSection('matches')} type="button">
            <span className="admin-menu-number">03</span><strong>Create matches</strong><span>Assign matches to a season</span>
          </button>
          <button className="admin-menu-card" onClick={() => setAdminSection('scoring')} type="button">
            <span className="admin-menu-number">04</span><strong>Score current season</strong><span>{currentSeasonMatches.length} matches</span>
          </button>
        </div>
      )}

      {adminSection === 'seasons' && (
        <section className="admin-panel">
          <form className="admin-form" onSubmit={createSeason}>
            <label>Season name<input name="name" required maxLength="100" placeholder="Winter 2026" /></label>
            <label>Format<select name="format" defaultValue="Singles" required><option value="Singles">Singles</option></select></label>
            <label>Start date<input name="startDate" type="date" required /></label>
            <label>End date<input name="endDate" type="date" /></label>
            <label className="checkbox-label"><input name="makeCurrent" type="checkbox" defaultChecked={!currentSeason} /> Make this the current season</label>
            <button className="primary-button" disabled={busy} type="submit">Create season</button>
          </form>
          <div className="admin-season-list">
            {seasons.length === 0 ? <p>No seasons yet.</p> : seasons.map((season) => (
              <div className="admin-season-row" key={season.id}>
                <div><strong>{season.name}</strong><span>{season.format || 'Singles'} · {season.isCurrent ? 'Current season' : 'Other season'}</span></div>
                {!season.isCurrent && <button disabled={busy} onClick={() => void makeCurrentSeason(season)} type="button">Make current</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      {adminSection === 'players' && (
        <section className="admin-panel">
          <form className="admin-form" onSubmit={createPlayer}>
            <label>Player name<input name="name" required maxLength="100" /></label>
            <button className="primary-button" disabled={busy} type="submit">Create player</button>
          </form>
          <div className="admin-season-list">
            {players.map((player) => (
              <div className="admin-season-row" key={player.id}>
                <div><strong>{player.name}</strong></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {adminSection === 'matches' && (
        <section className="admin-panel">
          {seasons.length === 0 || players.length < 2 ? <p>Create a season and at least two players first.</p> : (
            <form className="admin-form" onSubmit={createMatch}>
              <label>Season<select name="seasonId" value={matchSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)} required>
                {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.isCurrent ? ' (Current)' : ''}</option>)}
              </select></label>
              <label>Player 1<select name="player1Id" required defaultValue=""><option value="" disabled>Select player</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
              <label>Player 2<select name="player2Id" required defaultValue=""><option value="" disabled>Select player</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
              <label>Round<input name="round" required maxLength="60" placeholder="Final" /></label>
              <label>Match points<select name="matchPoints" defaultValue="21" required>
                <option value="11">11 points</option>
                <option value="15">15 points</option>
                <option value="21">21 points</option>
              </select></label>
              <button className="primary-button" disabled={busy} type="submit">Create match</button>
            </form>
          )}
          <div className="admin-match-list">
            {selectedSeasonMatches.length === 0 ? <p>No matches in this season yet.</p> : selectedSeasonMatches.map((match) => (
              <article className="admin-match-row" key={match.id}>
                <div><strong>{match.player1Name} vs {match.player2Name}</strong><span>{match.round} · {match.matchPoints ?? 21} points · {match.score1 ?? 0} : {match.score2 ?? 0} · {match.status}{match.winnerName ? ` · Winner: ${match.winnerName}` : ''}</span></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {adminSection === 'scoring' && (
        <section className="admin-panel">
          <h2>{currentSeason ? currentSeason.name : 'No current season selected'}</h2>
          {!currentSeason ? <p>Mark a season as current to manage its matches.</p> : currentSeasonMatches.length === 0 ? <p>No matches in the current season.</p> : (
            scoringMatch ? (
              <div className="admin-scoring-match">
                <button className="admin-back-button" onClick={() => setScoringMatchId('')} type="button">← All matches</button>
                <header className="scoring-match-title">
                  <div>
                    <p className="eyebrow">{scoringMatch.round} · First to {scoringMatch.matchPoints ?? 21} points</p>
                    <h3>{scoringMatch.player1Name} vs {scoringMatch.player2Name}</h3>
                  </div>
                  <span className={`scoring-status ${scoringMatch.status === 'Live' ? 'is-live' : ''}`}>{scoringMatch.status}</span>
                </header>
                {matchScoreState?.type === 'deuce' && (
                  <div className="scoring-state-banner is-deuce" role="status">
                    <strong>DEUCE</strong><span>Win by 2 points to take the match.</span>
                  </div>
                )}
                {matchScoreState?.type === 'advantage' && (
                  <div className="scoring-state-banner is-advantage" role="status">
                    <strong>ADVANTAGE</strong><span>{matchScoreState.player === 1 ? scoringMatch.player1Name : scoringMatch.player2Name} is one point ahead.</span>
                  </div>
                )}
                <div className="scoring-player-grid">
                  <article className="scoring-player-card">
                    <span className="scoring-player-label">PLAYER 1</span>
                    {matchScoreState?.type === 'advantage' && matchScoreState.player === 1 && <span className="scoring-advantage-tag">ADVANTAGE</span>}
                    <h4>{scoringMatch.player1Name}</h4>
                    <strong className="scoring-player-score">{scoringMatch.score1 ?? 0}</strong>
                    <button className="scoring-add-button" disabled={busy || scoringMatch.status !== 'Live'} onClick={() => void updateScore(scoringMatch, 'score1')} type="button" aria-label={`Add point for ${scoringMatch.player1Name}`}>+ Add point</button>
                  </article>
                  <article className="scoring-player-card">
                    <span className="scoring-player-label">PLAYER 2</span>
                    {matchScoreState?.type === 'advantage' && matchScoreState.player === 2 && <span className="scoring-advantage-tag">ADVANTAGE</span>}
                    <h4>{scoringMatch.player2Name}</h4>
                    <strong className="scoring-player-score">{scoringMatch.score2 ?? 0}</strong>
                    <button className="scoring-add-button" disabled={busy || scoringMatch.status !== 'Live'} onClick={() => void updateScore(scoringMatch, 'score2')} type="button" aria-label={`Add point for ${scoringMatch.player2Name}`}>+ Add point</button>
                  </article>
                </div>
                {scoringMatch.winnerName && <p className="scoring-winner" role="status">{scoringMatch.winnerName} wins!</p>}
              </div>
            ) : (
              <div className="admin-season-list">
                {currentSeasonMatches.map((match) => (
                  <div className="admin-season-row" key={match.id}>
                    <div><strong>{match.player1Name} vs {match.player2Name}</strong><span>{match.round} · {match.matchPoints ?? 21} points · {match.score1 ?? 0} : {match.score2 ?? 0} · {match.status}{match.winnerName ? ` · Winner: ${match.winnerName}` : ''}</span></div>
                    <button onClick={() => setScoringMatchId(match.id)} type="button">Open match</button>
                  </div>
                ))}
              </div>
            )
          )}
        </section>
      )}
    </div>
  )
}

function AdminGate({ players, seasons, matches, dataError }) {
  const [pin, setPin] = useState('')
  const [hasAccess, setHasAccess] = useState(() => localStorage.getItem(ADMIN_LOGIN_KEY) === 'true')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const settings = await getDocs(collection(db, 'smashVerseSettings'))
      const settingValues = settings.docs.map((setting) => setting.data())
      const hasPin = settingValues.some((value) => Object.prototype.hasOwnProperty.call(value, 'adminPin'))

      if (!hasPin) {
        setError('No adminPin field was found in smashVerseSettings. Check the collection and document.')
        return
      }

      const enteredPin = pin.trim()
      const matches = settingValues.some((value) => (
        value.adminPin !== null
        && value.adminPin !== undefined
        && String(value.adminPin).trim() === enteredPin
      ))
      if (!matches) {
        setError('Incorrect password.')
        return
      }
      setPin('')
      localStorage.setItem(ADMIN_LOGIN_KEY, 'true')
      setHasAccess(true)
    } catch (readError) {
      setError(`Could not verify the password: ${readError.message}`)
    } finally {
      setBusy(false)
    }
  }

  const logout = () => {
    localStorage.removeItem(ADMIN_LOGIN_KEY)
    setPin('')
    setError('')
    setHasAccess(false)
  }

  if (hasAccess) return <AdminDashboard players={players} seasons={seasons} matches={matches} dataError={dataError} onLogout={logout} />

  return (
    <div className="admin-card">
      <p className="eyebrow">SMASH VERSE PRO</p>
      <h1>Admin password</h1>
      <form className="admin-form" onSubmit={submit}>
        <label>Password<input type="password" autoComplete="current-password" value={pin} onChange={(event) => setPin(event.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy} type="submit">{busy ? 'Checking…' : 'Continue'}</button>
      </form>
      <a href="/">← Back to site</a>
    </div>
  )
}

function App() {
  const [page, setPage] = useState('Dashboard')
  const path = window.location.pathname.replace(/\/+$/, '')
  const isAdminRoute = path === '/admin' || new URLSearchParams(window.location.search).get('admin') === '1'
  const { players, seasons, matches, error: dataError } = usePublicData()

  if (isAdminRoute) {
    return <AdminGate players={players} seasons={seasons} matches={matches} dataError={dataError} />
  }

  return (
    <PublicShell page={page} setPage={setPage}>
      <PublicPages page={page} players={players} seasons={seasons} matches={matches} dataError={dataError} />
    </PublicShell>
  )
}

export default App
