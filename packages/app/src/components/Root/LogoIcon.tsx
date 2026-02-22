import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core';
import wlogo from './logo/wlogo.png';
import { CUSTOM_LOGO_KEY } from '../settings/CustomLogoSettings';

const useStyles = makeStyles({
  backstagelogoHolder: {
    width: '100%',
    padding: '10px',
    background: '#383838',
    borderRadius: '4px',
  },
});

const LogoIcon = () => {
  const classes = useStyles();
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

  if (customLogo) {
    return (
      <div className={classes.backstagelogoHolder}>
        <img
          src={customLogo}
          alt="Logo"
          style={{
            width: 42,
            height: 28,
            objectFit: 'contain',
            display: 'block',
            margin: '0 auto',
          }}
        />
      </div>
    );
  }

  return (
    <div className={classes.backstagelogoHolder}>
      <img
        src={wlogo}
        alt="Logo"
        style={{
          width: 42,
          height: 42,
          objectFit: 'contain',
          display: 'block',
          margin: '0 auto',
          borderRadius: 4,
        }}
      />
    </div>
  );
};

export default LogoIcon;
