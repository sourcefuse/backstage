import React, { useEffect, useState } from 'react';
import wlogo from './logo/wlogo.png';
import { CUSTOM_LOGO_KEY } from '../settings/CustomLogoSettings';

const LogoFull = () => {
  const [customLogo, setCustomLogo] = useState<string | null>(() =>
    localStorage.getItem(CUSTOM_LOGO_KEY),
  );

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === CUSTOM_LOGO_KEY || e.key === null) {
        setCustomLogo(localStorage.getItem(CUSTOM_LOGO_KEY));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <img
      src={customLogo ?? wlogo}
      alt="Logo"
      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
    />
  );
};

export default LogoFull;
