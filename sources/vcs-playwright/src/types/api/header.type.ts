export const Header = {
  CONTENT_TYPE: 'content-type',
  X_REQUEST_ID: 'x-request-id',
  LOCATION: 'location',
  LINK: 'link',
  X_TOTAL_COUNT: 'x-total-count',
} as const;

export const ContentType = {
  TEXT_PLAIN: /text\/plain/i,
  APPLICATION_JSON: /application\/json/i,
  APPLICATION_PROBLEM_JSON: /application\/problem\+json/i,
} as const;
