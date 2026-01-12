/**
 * Counter class - manages counter state and operations
 */
export class Counter {
  private value: number;
  private onChange: ((value: number) => void) | null = null;

  constructor(initialValue: number = 0) {
    this.value = initialValue;
  }

  getValue(): number {
    return this.value;
  }

  increment(): number {
    this.value++;
    this.notifyChange();
    return this.value;
  }

  decrement(): number {
    this.value--;
    this.notifyChange();
    return this.value;
  }

  reset(): number {
    this.value = 0;
    this.notifyChange();
    return this.value;
  }

  setOnChange(callback: (value: number) => void): void {
    this.onChange = callback;
  }

  private notifyChange(): void {
    if (this.onChange) {
      this.onChange(this.value);
    }
  }
}
