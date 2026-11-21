export const API_PREFIX = '/api/v1';

export const JSON_BODY_LIMIT = '100kb';

export const SESSION_COOKIE_NAME = 'fd_session';

/**
 * Upper bound for a donation quantity. Matches the contract's `DonationCreateRequest.quantity`
 * maximum and the `numeric(10,2)` database column, so request validation cannot accept a
 * value the database would reject.
 */
export const MAX_DONATION_QUANTITY = 99_999_999.99;
