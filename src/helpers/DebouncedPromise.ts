export class DebouncedPromise<PromiseReturnType> {
  public resolve!: (value: PromiseReturnType) => void;
  public reject!: (reason: Error) => void;
  public promise: Promise<PromiseReturnType>;

  constructor() {
    this.promise = new Promise<PromiseReturnType>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
