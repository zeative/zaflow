export const getRandomValue = (arr: string[]) => {
  return arr[Math.floor(Math.random() * arr.length)];
};

export const compactJson = (obj: any, pruneEmpty = true) => {
  const cleaned = pruneEmpty ? Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v !== '')) : obj;
  return JSON.stringify(cleaned).replace(/"([^"]+)":/g, '$1:');
};

export const suffleArray = (arr: string[]) => {
  return arr.sort(() => Math.random() - 0.5);
};
