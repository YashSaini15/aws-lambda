export const logger = {
  info: (message: string, data?: object) => {
    console.log(JSON.stringify({ level: "INFO", message, ...data }));
  },
  error: (message: string, data?: object) => {
    console.error(JSON.stringify({ level: "ERROR", message, ...data }));
  },
};
