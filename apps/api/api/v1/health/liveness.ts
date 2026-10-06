/** Probe liviano sin Nest: para monitores de uptime y para mantener la instancia tibia. */
export default function handler(
  _req: unknown,
  res: { status: (n: number) => { json: (o: object) => void } },
) {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
}
