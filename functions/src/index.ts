import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import * as express from 'express';
import * as cors from 'cors';
import FieldValue = admin.firestore.FieldValue;
import {Card} from "./card";


// Firebase
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://uno-game-8ef64.firebaseio.com"
});
const db = admin.firestore();


export const helloWorld = functions.https.onRequest((request, response) => {
  response.json("Hello from the other side! matias kupfer");
});

export const removeFinishedGame = functions.firestore
  .document("games/{gameId}")
  .onUpdate((change, context) => {
    setTimeout(
      function deleteGame() {
        // @ts-ignore
        if (change.after.data().gameFinished) {
          // @ts-ignore
          db.collection('games').doc(change.after.data().gameId).delete().then((f) => {
            console.log('removed')
          }).catch(e => {
            console.log(e)
          })
        }
      }, 5000)
  });

// Express
const app = express();

require('./check-status')(app);
app.use(cors({origin: true}));


// Petitions
app.post('/create-game/:gameId/:gamePassword/:player', async (req, res) => {
  const gameId = req.params.gameId;
  const gamePassword = req.params.gamePassword;
  const player = req.params.player;

  await checkGameExists(gameId).get().then(docSnapshot => {
    if (!docSnapshot.exists) {
      const newGameRef = db.collection('games').doc(gameId);
      newGameRef.set({
        gameId: gameId,
        password: gamePassword,
        players: [player],
        deck: JSON.parse(JSON.stringify(generateDeck())),
        gameStarted: false,
        gameFinished: false,
        nextPlayerCounter: 0,
        winners: [],
        tableCard: [],
        decksLength: [],
        playerTurn: null,
        playerDrawCard: false,
        skipTurnCounter: 0,
        drawCardsCounter: 0,
        lastPlayerCard: null,
        reverseDirection: false,
        tableColor: null,
      }).then(response => { // game created
        res.json({
          success: true,
          message: 'Created ' + gameId + ' game as ' + player,
          // @ts-ignore
          game: response._fieldsProto
        })
      }).catch(e => { // error creating game
        res.json({
          success: false,
          message: 'error creating the game'
        })
      });
    } else {
      res.json({ // gameId exists
        success: false,
        message: 'game ' + gameId + ' alredy exists, try another name'
      })
    }
  });
});

app.post('/join-game/:gameId/:gamePassword/:player', async (req, res) => {
  const gameId = req.params.gameId;
  const gamePassword = req.params.gamePassword;
  const player = req.params.player;
  await checkGameExists(gameId).get().then(docSnapshot => {
    // @ts-ignore
    if (docSnapshot && docSnapshot._fieldsProto.password.stringValue === gamePassword &&
      // @ts-ignore
      !docSnapshot._fieldsProto.gameStarted.booleanValue) {
      const addUserToGame = db.collection('games').doc(gameId);
      addUserToGame.update({
        'players': FieldValue.arrayUnion(player)
      }).then(() => {
        res.json({ // game joined
          success: true,
          message: 'joined ' + gameId + ' game as ' + player,
          // @ts-ignore
          game: docSnapshot._fieldsProto
        })
      }).catch(e => {
        res.json({
          success: false,
          message: 'error pushing player to firebase',
        })
      });
    } else {
      res.json({ // wrong password
        success: false,
        message: 'game does not exist | incorrect password | game started'
      })
    }
  }).catch(e => {
    res.json({ // game does not exist
      success: false,
      message: 'game does not exist or password is incorrect'
    })
  });
});

app.post('/connect-game/:gameId/:player', async (req, res) => {
  const gameId = req.params.gameId;
  const player = req.params.player;

  return checkGameExists(gameId).get().then(docSnapshot => {
    if (docSnapshot.exists) {
      // @ts-ignore
      if (checkValidUser(docSnapshot._fieldsProto.players.arrayValue.values, player)) {
        res.json({ // the player exists on the game
          success: true,
          game: docSnapshot,
          message: 'connected'
        });
      } else { // player not in the game list
        res.json({ // the player exists on the game
          success: false,
          message: 'unable to join the game'
        });
      }
    } else {
      res.json({ // game does not exist
          success: false,
          'error': 'game does not exist'
        }
      );
    }
  })
});


// Functions
function checkGameExists(gameId: string) {
  return db.collection('games').doc(gameId);
}

function checkValidUser(playersList: any[], newPlayer: string) {
  for (const player of playersList) {
    if (player.stringValue === newPlayer) {
      return true;
    }
  }
  return false;
}

function generateDeck() {
  const deck = [];
  for (let cardsColor = 0; cardsColor < 4; cardsColor++) {
    for (let cardValue = 0; cardValue <= 14; cardValue++) {
      if (cardValue === 0) {
        const newCard = new Card(cardValue, cardsColor);
        // @ts-ignore
        deck.push(newCard);
      } else if (cardValue > 0 && cardValue <= 9) {
        const newCard = new Card(cardValue, cardsColor);
        // @ts-ignore
        deck.push(newCard);
        // @ts-ignore
        deck.push(newCard);
      } else if (cardValue > 9 && cardValue <= 12) {
        const newCard = new Card(cardValue, cardsColor);
        // @ts-ignore
        deck.push(newCard);
        // @ts-ignore
        deck.push(newCard);
      }
    }
  }

  for (let specialCards = 13; specialCards <= 14; specialCards++) {
    const newCard = new Card(specialCards, 4);
    for (let i = 0; i < 4; i++) {
      // @ts-ignore
      deck.push(newCard);
    }
  }
  const notSpecialCard = false;
  while (!notSpecialCard) {
    const mixedDeck = mixDeck(deck);
    if (mixedDeck[0].value !== (10 || 11 || 12 || 13 || 14)) {
      return mixedDeck;
    }
  }
}

function mixDeck(deck: Card[]) {
  let n = 0;
  while (n < 300) {
    const randomIndex = Math.floor(Math.random() * deck.length);
    const randomIndex2 = Math.floor(Math.random() * deck.length);
    const saveTempCard: Card = deck[randomIndex];
    deck[randomIndex] = deck[randomIndex2];
    deck[randomIndex2] = saveTempCard;
    n++;
  }
  return deck;
}

exports.api = functions.https.onRequest(app);



