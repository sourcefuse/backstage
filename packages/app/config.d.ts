export interface Config {
  app: {
    /**
     * Whether to show the Guest login option on the sign-in page.
     * Set ENABLE_GUEST_LOGIN=true in .env.local to enable.
     * @visibility frontend
     */
    enableGuestLogin?: boolean;
  };
}
