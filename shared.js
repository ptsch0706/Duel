/* ============================================================
   DUEL — shared Firebase config + room helpers
   Loaded by every page (index.html, boggle.html, ladder.html,
   telephone.html) so there's exactly one place that knows how
   Firebase is set up and how a two-player room works.

   FIREBASE SETUP:
   1. https://console.firebase.google.com — use an existing
      project (fine to reuse Crumb/Crust/Streaks' project; this
      just adds its own collections, "boggleRooms" etc.) or make
      a new one.
   2. Register a web app (</> icon) if you haven't, copy the
      firebaseConfig object it gives you, paste it below.
   3. Firestore Database > Create database (test mode is fine).
   4. Firestore > Rules — paste this and Publish:

      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /{document=**} {
            allow read, write: if true;
          }
        }
      }

      (Same idea as before — the room code is the "password".
      This now covers every Duel game's collection, not just
      Boggle's, so you only set the rule once.)
   ============================================================ */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
try{
  firebase.initializeApp(firebaseConfig);
}catch(e){
  console.warn('Firebase init failed — fine for local/solo practice, but online play needs a real config in shared.js', e);
}

const Duel = {
  // Lazily create the Firestore connection, and never let a bad/placeholder
  // firebaseConfig crash the page — local/solo practice mode never touches
  // this, so someone should be able to test-play before Firebase is set up.
  _db: null,
  get db(){
    if(!this._db){
      try{ this._db = firebase.firestore(); }
      catch(e){ console.warn('Firestore unavailable — online play needs a real firebaseConfig in shared.js', e); }
    }
    return this._db;
  },

  /* ---- small utilities ---- */
  roomCode(){ return Math.random().toString(36).slice(2,6).toUpperCase(); },
  uid(){ return Math.random().toString(36).slice(2,9); },

  /* Remember the player's name across games/visits so they don't
     retype it every time. Plain localStorage — fine for a
     non-sensitive nickname on a device only you and your wife use. */
  getSavedName(){ return localStorage.getItem('duel_playerName') || ''; },
  saveName(name){ localStorage.setItem('duel_playerName', name); },

  /* Every page includes a <div class="toast" id="toast"></div> —
     this is the one shared way to pop a message over it. */
  toast(msg, ms=2600){
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(()=>t.classList.remove('show'), ms);
  },

  /* ---- room lifecycle, shared by every game ----
     Every game's room doc follows the same shape at the top level:
       { status: 'lobby' | ...(game-specific states)...,
         p1: { name, ...game-specific state },
         p2: null | { name, ...game-specific state },
         createdAt }
     The game-specific fields (a Boggle word list, a Ladder guess
     history, a Telephone drawing chain) are passed in as p1State/
     p2State/extra and are the only part each game needs to define
     for itself. */

  createRoom(collection, name, p1State={}, extra={}){
    const id = this.roomCode();
    return this.db.collection(collection).doc(id).set({
      status: 'lobby',
      p1: { name, ...p1State },
      p2: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...extra
    }).then(()=> id);
  },

  joinRoom(collection, code, name, p2State={}){
    const ref = this.db.collection(collection).doc(code);
    return ref.get().then(snap=>{
      if(!snap.exists) return { ok:false, reason:'notfound' };
      const data = snap.data();
      if(data.p2) return { ok:false, reason:'full' };
      return ref.update({ p2: { name, ...p2State } }).then(()=> ({ ok:true, data }));
    });
  },

  subscribeRoom(collection, code, cb){
    return this.db.collection(collection).doc(code).onSnapshot(snap=>{
      if(snap.exists) cb(snap.data());
    });
  }
};
