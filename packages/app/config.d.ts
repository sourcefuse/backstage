export interface Config {
  app: {
    /**
     * Whether to show the Guest login option on the sign-in page.
     * Set ENABLE_GUEST_LOGIN=true in .env.local to enable.
     * @visibility frontend
     */
    enableGuestLogin?: boolean;
  };
  newrelic?: {
    /**
     * New Relic API key used to enable New Relic tabs in the entity page.
     * Set NEW_RELIC_USER_KEY in your environment.
     * @visibility frontend
     */
    token?: string;
  };
}
