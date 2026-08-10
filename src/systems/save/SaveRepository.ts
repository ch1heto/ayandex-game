/**
 * Future save systems depend on this interface, not directly on browser or
 * Yandex storage. The concrete adapter will be selected by the platform layer.
 */
export interface SaveRepository<TSave> {
  load(): Promise<TSave | undefined>;
  save(data: TSave): Promise<void>;
}
