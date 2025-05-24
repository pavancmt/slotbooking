import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import SlotBookingSystem from './SlotBookingSystem';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <SlotBookingSystem />
  </React.StrictMode>
);

serviceWorkerRegistration.register();
