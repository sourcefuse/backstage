import React from 'react';
import { makeStyles } from '@material-ui/core';
import arcLogo from './logo/arc2.png';

const useStyles = makeStyles({
  backstagelogoHolder: {
    width: '100%',
    padding: '10px',
    background: '#black',
    borderRadius: '4px',
  },
  svgback: {
    width: 'auto',
    height: 30,
  },
  pathback: {
    fill: '#E81823',
  },
});
const LogoFull = () => {
  return <img src={arcLogo} />;
};

export default LogoFull;
