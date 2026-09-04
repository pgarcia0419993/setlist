import { useState } from 'react';
import Host from './components/Host.jsx';
import Guest from './components/Guest.jsx';

export default function App() {
  const [room] = useState(
    () => new URLSearchParams(window.location.search).get('room')
  );
  return room ? <Guest room={room.toUpperCase()} /> : <Host />;
}
