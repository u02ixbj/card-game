import React, { useState } from 'react';
import styles from './Lobby.module.css';

export default function Lobby({ onCreate, onJoin, error }) {
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState(null); // 'create' | 'join'

  function handleCreate(e) {
    e.preventDefault();
    if (username.trim()) onCreate(username.trim());
  }

  function handleJoin(e) {
    e.preventDefault();
    if (username.trim() && code.trim()) onJoin(code.trim().toUpperCase(), username.trim());
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Bugger Bridge</h1>
        <p className={styles.subtitle}>A trick-taking card game</p>

        {!mode && (
          <div className={styles.buttons}>
            <button className="btn-primary" onClick={() => setMode('create')}>Create Room</button>
            <button className="btn-secondary" onClick={() => setMode('join')}>Join Room</button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className={styles.form}>
            <label>Your name</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter a username"
              autoFocus
              maxLength={20}
            />
            <div className={styles.formButtons}>
              <button type="button" className="btn-secondary" onClick={() => setMode(null)}>Back</button>
              <button type="submit" className="btn-primary" disabled={!username.trim()}>Create</button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className={styles.form}>
            <label>Room code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="4-letter code"
              maxLength={4}
              autoFocus
            />
            <label>Your name</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter a username"
              maxLength={20}
            />
            <div className={styles.formButtons}>
              <button type="button" className="btn-secondary" onClick={() => setMode(null)}>Back</button>
              <button type="submit" className="btn-primary" disabled={!username.trim() || code.length !== 4}>
                Join
              </button>
            </div>
          </form>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
