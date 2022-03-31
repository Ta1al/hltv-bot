const cache = new Map<string | number, any>();

export const get = (id: string | number) => cache.get(id);
export const set = (id: string | number, value: any, life: number) => {
  cache.set(id, value);
  setTimeout(() => cache.delete(id), life);
};
