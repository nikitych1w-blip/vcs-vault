export function normalizeCollection(collection, surface) {
  applyGenerationPolicy(collection, surface.policy);
  sanitizeCollection(collection);
  return collection;
}

export function splitCollectionByFolder(collection, surface) {
  const topLevelItems = collection.item ?? [];

  if (topLevelItems.length === 0) {
    throw new Error(`Postman collection for surface "${surface.id}" does not contain top-level items.`);
  }

  return topLevelItems.map((item) => {
    const folderName = getFolderName(surface, item.name);
    const fileName = `${surface.collectionPrefix} ${folderName}.json`;
    const collectionName = `${surface.collectionPrefix} ${folderName}`;

    return {
      folderName,
      fileName,
      collection: buildSplitCollection(collection, item, collectionName, folderName),
    };
  });
}

function applyGenerationPolicy(collection, policy = {}) {
  if (policy.auth) {
    collection.auth = buildCollectionAuth(policy.auth);
  }

  if (policy.removeTopLevelVariables) {
    delete collection.variable;
  }
}

function buildCollectionAuth(authPolicy) {
  if (authPolicy.type !== 'basic') {
    throw new Error(`Unsupported auth policy "${authPolicy.type}".`);
  }

  return {
    type: 'basic',
    basic: [
      { key: 'username', value: `{{${authPolicy.usernameVariable}}}`, type: 'string' },
      { key: 'password', value: `{{${authPolicy.passwordVariable}}}`, type: 'string' },
    ],
  };
}

export function buildSplitCollection(collection, item, name, folderName) {
  const splitCollection = structuredClone(collection);
  splitCollection.info.name = name;
  splitCollection.item = [structuredClone(item)];
  splitCollection.item[0].name = folderName;

  const { info, item: items, ...rest } = splitCollection;
  return { info, item: items, ...rest };
}

export function sanitizeCollection(collection) {
  if (Array.isArray(collection.event) && collection.event.length === 0) {
    delete collection.event;
  }

  if (collection.info) {
    const description = normalizeDescription(collection.info.description);

    if (description !== undefined) {
      collection.info.description = description;
    } else {
      delete collection.info.description;
    }
  }

  for (const item of collection.item ?? []) {
    sanitizeItem(item);
  }
}

export function sanitizeItem(item) {
  delete item.id;
  delete item.protocolProfileBehavior;

  if (Array.isArray(item.event) && item.event.length === 0) {
    delete item.event;
  }

  const description = normalizeDescription(item.description);
  if (description !== undefined) {
    item.description = description;
  } else {
    delete item.description;
  }

  if (item.request) {
    delete item.request.name;

    if (item.request.auth === null) {
      delete item.request.auth;
    }

    const requestDescription = normalizeDescription(item.request.description);
    if (requestDescription !== undefined) {
      item.request.description = requestDescription;
    } else {
      delete item.request.description;
    }

    addRawUrl(item.request.url);
  }

  if (Array.isArray(item.response)) {
    for (const response of item.response) {
      sanitizeResponse(response);
    }
  }

  if (Array.isArray(item.item)) {
    for (const child of item.item) {
      sanitizeItem(child);
    }
  }
}

export function sanitizeResponse(response) {
  delete response.id;

  if (response.originalRequest) {
    addRawUrl(response.originalRequest.url);

    const body = response.originalRequest.body;
    if (body && typeof body === 'object' && Object.keys(body).length === 0) {
      delete response.originalRequest.body;
    }
  }
}

export function normalizeDescription(description) {
  if (description === null || description === undefined) {
    return undefined;
  }

  if (typeof description === 'string') {
    return description.length > 0 ? description : undefined;
  }

  if (typeof description === 'object') {
    const content = description.content;
    return typeof content === 'string' && content.length > 0 ? content : undefined;
  }

  return undefined;
}

export function addRawUrl(urlObj) {
  if (!urlObj || typeof urlObj !== 'object' || urlObj.raw) {
    return;
  }

  const rawUrl = buildRawUrl(urlObj);
  if (rawUrl.length > 0) {
    urlObj.raw = rawUrl;
  }
}

export function buildRawUrl(urlObj) {
  const host = (urlObj.host ?? []).join('.');
  const pathStr = (urlObj.path ?? []).join('/');
  const base = host ? `${host}/${pathStr}` : pathStr;
  const enabledQuery = (urlObj.query ?? []).filter((queryParam) => !queryParam.disabled);
  const queryStr = enabledQuery
    .map((queryParam) => `${queryParam.key}=${queryParam.value}`)
    .join('&');

  return queryStr ? `${base}?${queryStr}` : base;
}

export function getFolderName(surface, rawName) {
  const normalizedKey = String(rawName ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();

  return surface.folderNameOverrides?.[normalizedKey] ?? toPascalCase(rawName);
}

export function toPascalCase(value) {
  const tokens = String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return 'Untagged';
  }

  return tokens
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join('');
}
