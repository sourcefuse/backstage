import React, { useRef, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import arcLogo from '../Root/logo/arc.png';

export const CUSTOM_LOGO_KEY = 'backstage.customLogo';

function dispatchLogoChange() {
  window.dispatchEvent(new StorageEvent('storage', { key: CUSTOM_LOGO_KEY }));
}

const useStyles = makeStyles(theme => ({
  previewBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 80,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    background: '#f5f5f5',
    marginBottom: theme.spacing(2),
  },
  previewImg: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  hiddenInput: {
    display: 'none',
  },
}));

export const CustomLogoSettings = () => {
  const classes = useStyles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const currentStored = localStorage.getItem(CUSTOM_LOGO_KEY);
  const preview = selected ?? currentStored ?? arcLogo;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setSelected(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!selected) return;
    localStorage.setItem(CUSTOM_LOGO_KEY, selected);
    dispatchLogoChange();
    setSelected(null);
  };

  const handleReset = () => {
    localStorage.removeItem(CUSTOM_LOGO_KEY);
    dispatchLogoChange();
    setSelected(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader title="Custom Sidebar Logo" subheader="Upload an image to replace the default ARC logo in the sidebar" />
      <Divider />
      <CardContent>
        <Typography variant="body2" gutterBottom>
          Preview
        </Typography>
        <Box className={classes.previewBox}>
          <img src={preview} alt="Logo preview" className={classes.previewImg} />
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={classes.hiddenInput}
          onChange={handleFileChange}
        />

        <Box className={classes.actions}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose Image
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="small"
            disabled={!selected}
            onClick={handleSave}
          >
            Save
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={!currentStored && !selected}
            onClick={handleReset}
          >
            Reset to Default
          </Button>
        </Box>

        {selected && (
          <Typography variant="caption" color="textSecondary" style={{ marginTop: 8, display: 'block' }}>
            Click Save to apply the new logo.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
