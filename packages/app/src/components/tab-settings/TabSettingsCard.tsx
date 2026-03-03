import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  IconButton,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { TabDefinition } from './types';

export const TabVisibilityDialog = ({
  tabs,
  open,
  onClose,
  toggleTab,
  isTabEnabled,
}: {
  tabs: TabDefinition[];
  open: boolean;
  onClose: () => void;
  toggleTab: (id: string) => void;
  isTabEnabled: (id: string) => boolean;
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        Tab Visibility
        <IconButton
          aria-label="close"
          onClick={onClose}
          style={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <List dense>
          {tabs.map(tab => (
            <ListItem key={tab.id}>
              <ListItemText primary={tab.title} />
              <ListItemSecondaryAction>
                <Switch
                  edge="end"
                  checked={isTabEnabled(tab.id)}
                  onChange={() => toggleTab(tab.id)}
                  color="primary"
                />
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};
