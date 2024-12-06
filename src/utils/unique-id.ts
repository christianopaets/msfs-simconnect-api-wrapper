export class UniqueId {
  private id: number = 0;
  private readonly reserved = new Set<number>();

  next(): number {
    if (this.id > 900) {
      this.id = 0;
    }
    let id = this.id++;
    while (this.reserved.has(id)) {
      id = this.id++;
    }
    this.reserved.add(id);
    return id;
  }

  release(id: number): void {
    this.reserved.delete(id);
  }
}
