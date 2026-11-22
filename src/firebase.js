import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDELMYGpJ9DT89i6oYK_OhvTDeleUDfv6w",
  authDomain: "fury-on-the-board.firebaseapp.com",
  projectId: "fury-on-the-board",
  storageBucket: "fury-on-the-board.firebasestorage.app",
  messagingSenderId: "447778947814",
  appId: "1:447778947814:web:bab5dc4e9b46a13b393127",
  measurementId: "G-0VTNH2L7KT",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
