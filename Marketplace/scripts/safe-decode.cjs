/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
const originalDecodeURIComponent = global.decodeURIComponent;

global.decodeURIComponent = (value) => {
  try {
    return originalDecodeURIComponent(value);
  } catch {
    return value;
  }
};
