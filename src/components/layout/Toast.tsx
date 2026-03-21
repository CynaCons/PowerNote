import { useEffect, useState } from 'react';
import './Toast.css';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
let listeners: ((msg: ToastMessage) => void)[] = [];

export function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
  const msg: ToastMessage = { id: ++toastId, text, type };
  listeners.forEach((fn) => fn(msg));
}

export function Toast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }, 3000);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((fn) => fn !== handler);
    };
  }, []);

  if (messages.length === 0) return null;

  return (
    <div className="toast-container" data-testid="toast-container">
      {messages.map((msg) => (
        <div key={msg.id} className={`toast toast--${msg.type}`} data-testid="toast">
          {msg.text}
        </div>
      ))}
    </div>
  );
}
