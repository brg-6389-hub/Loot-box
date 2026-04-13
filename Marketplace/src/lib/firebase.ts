/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCKUrMKXe2OIZxj762p2GF2WGLO6OcJN-Y',
  authDomain: 'marvel-d319c.firebaseapp.com',
  projectId: 'marvel-d319c',
  storageBucket: 'marvel-d319c.firebasestorage.app',
  messagingSenderId: '254453187629',
  appId: '1:254453187629:web:9b1e05e8332d011583a4a4',
};

const app = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(app);

export { firebaseAuth };
