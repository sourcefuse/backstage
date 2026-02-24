import React, { PropsWithChildren } from 'react';
import { makeStyles } from '@material-ui/core';
// import HomeIcon from '@material-ui/icons/Home';
import { Homeicon } from '../../assets/icons/CustomIcons';
import ExtensionIcon from '@material-ui/icons/Extension';
import MapIcon from '@material-ui/icons/MyLocation';
import LibraryBooks from '@material-ui/icons/LibraryBooks';
import CreateComponentIcon from '@material-ui/icons/AddCircleOutline';
import LogoFull from './LogoFull';
import LogoIcon from './LogoIcon';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import SettingsIcon from '@material-ui/icons/Settings';
import { SidebarSearchModal } from '@backstage/plugin-search';
import {
  Sidebar,
  sidebarConfig,
  // SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarPage,
  SidebarSpace,
  SidebarSubmenu,
  SidebarSubmenuItem,
  useSidebarOpenState,
  Link,
} from '@backstage/core-components';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import { MyGroupsSidebarItem } from '@backstage/plugin-org';
import GroupIcon from '@material-ui/icons/People';
import CampaignIcon from '@material-ui/icons/Announcement';
import StorageIcon from '@material-ui/icons/Storage';
import CategoryIcon from '@material-ui/icons/Category';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import AssignmentIcon from '@material-ui/icons/Assignment';
import RoomIcon from '@material-ui/icons/Room';
import PersonIcon from '@material-ui/icons/Person';
import DevicesIcon from '@material-ui/icons/Devices';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';

const useSidebarLogoStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    height: 3 * sidebarConfig.logoHeight,
    display: 'flex',
    flexFlow: 'row nowrap',
    alignItems: 'center',
    marginBottom: 0,
  },
  link: {
    width: '90%',
    margin: '0 auto',
  },
  collapseBtn: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
    borderRadius: 4,
    color: theme.palette.common.white,
    opacity: 0.6,
    '&:hover': {
      opacity: 1,
      background: 'rgba(255,255,255,0.12)',
    },
  },
}));

const LogoutButton = () => {
  const identityApi = useApi(identityApiRef);
  return (
    <SidebarItem
      icon={ExitToAppIcon}
      text="Logout"
      onClick={() => identityApi.signOut()}
    />
  );
};

const SidebarLogo = () => {
  const classes = useSidebarLogoStyles();
  const { isOpen, setOpen } = useSidebarOpenState();

  return (
    <div className={classes.root}>
      <Link to="/" underline="none" className={classes.link} aria-label="Home">
        {isOpen ? <LogoFull /> : <LogoIcon />}
      </Link>
      {isOpen && (
        <div
          className={classes.collapseBtn}
          onClick={() => setOpen(false)}
          onKeyDown={e => e.key === 'Enter' && setOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Collapse sidebar"
        >
          <ChevronLeftIcon fontSize="small" />
        </div>
      )}
    </div>
  );
};

export const Root = ({ children }: PropsWithChildren<{}>) => (
  <SidebarPage>
    <Sidebar>
      <SidebarLogo />
      <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
        <SidebarSearchModal />
      </SidebarGroup>
      {/* <SidebarDivider /> */}
      <SidebarGroup label="Menu" icon={<MenuIcon />}>
        <SidebarItem icon={Homeicon} to="/home" text="Home" />
        <SidebarItem icon={ExtensionIcon} to="api-docs" text="APIs" />
        <SidebarItem icon={CategoryIcon} to="catalog" text="Catalog">
          <SidebarSubmenu title="Catalog">
            <SidebarSubmenuItem
              title="Components"
              to="catalog?filters[kind]=component&filters[user]=all"
              icon={CategoryIcon}
            />
            <SidebarSubmenuItem
              title="Groups"
              to="catalog?filters[kind]=group&filters[user]=all"
              icon={GroupIcon}
            />
            <SidebarSubmenuItem
              title="Locations"
              to="catalog?filters[kind]=location&filters[user]=all"
              icon={RoomIcon}
            />
            <SidebarSubmenuItem
              title="Resources"
              to="catalog?filters[kind]=resource&filters[user]=all"
              icon={StorageIcon}
            />
            <SidebarSubmenuItem
              title="Systems"
              to="catalog?filters[kind]=system&filters[user]=all"
              icon={DevicesIcon}
            />
            <SidebarSubmenuItem
              title="Templates"
              to="catalog?filters[kind]=template&filters[user]=all"
              icon={AssignmentIcon}
            />
            <SidebarSubmenuItem
              title="Users"
              to="catalog?filters[kind]=user&filters[user]=all"
              icon={PersonIcon}
            />
          </SidebarSubmenu>
        </SidebarItem>
        <SidebarItem icon={LibraryBooks} to="docs" text="Docs" />
        <SidebarItem icon={MapIcon} to="tech-radar" text="Tech Radar" />
        <SidebarItem icon={CreateComponentIcon} to="create" text="Create..." />
        <SidebarItem icon={CampaignIcon} to="announcements" text="Announcements" />
      </SidebarGroup>
      <SidebarSpace />
      {/* <SidebarDivider /> */}
      <SidebarGroup
        label="Settings"
        icon={<UserSettingsSignInAvatar />}
        to="/settings"
      >
        <SidebarItem icon={SettingsIcon} to="settings" text="Settings" />
        <MyGroupsSidebarItem
          singularTitle="My Group"
          pluralTitle="My Groups"
          icon={GroupIcon}
        />
        <LogoutButton />
      </SidebarGroup>
    </Sidebar>
    {children}
  </SidebarPage>
);
