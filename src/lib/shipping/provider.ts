export interface ShipmentInput {
  orderId: string;
  carrier: string;
  trackingNumber: string;
}

export interface ManualShipment {
  orderId: string;
  provider: "manual";
  carrier: string;
  trackingNumber: string;
  verification: "SELLER_REPORTED";
  shippedAt: string;
}

export interface ShippingProvider {
  readonly name: string;
  createShipment(input: ShipmentInput): Promise<ManualShipment>;
}

/** No carrier network is called. Server/SQL must validate seller ownership and paid order state. */
export class ManualShippingProvider implements ShippingProvider {
  readonly name = "manual";
  constructor(private readonly now: () => number = Date.now) {}

  async createShipment(input: ShipmentInput): Promise<ManualShipment> {
    const carrier = input.carrier.trim();
    const trackingNumber = input.trackingNumber.trim();
    if (!input.orderId || carrier.length < 2 || carrier.length > 80 || /[\u0000-\u001f\u007f]/.test(carrier)) throw new Error("A carrier name of 2–80 characters is required.");
    if (!/^[A-Za-z0-9][A-Za-z0-9 ./_-]{3,99}$/.test(trackingNumber)) throw new Error("A tracking number of 4–100 letters, digits or common separators is required.");
    return { orderId: input.orderId, provider: "manual", carrier, trackingNumber, verification: "SELLER_REPORTED", shippedAt: new Date(this.now()).toISOString() };
  }
}
