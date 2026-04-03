import React, { useState, useEffect, useRef } from 'react';
import styles from './Chat.module.css';

export default function Chat({ messages, onSend }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <div className={styles.chat}>
      <div className={styles.header}>Chat</div>
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={styles.message}>
            <span className={styles.username}>{msg.username}</span>
            <span className={styles.text}>{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Say something…"
          maxLength={200}
        />
        <button type="submit" className={styles.sendBtn} disabled={!input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
