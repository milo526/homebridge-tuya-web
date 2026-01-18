/**
 * Delay for a given time
 * @param t time in ms
 */
export default function delay(t: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, t);
  });
}
