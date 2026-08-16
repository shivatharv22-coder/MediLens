/**
 * Transactional email abstraction.
 *
 * MediLens must never claim an email was sent when it was not, so `send`
 * reports how the message was actually delivered and the API surfaces that to
 * the user verbatim.
 */

export type DeliveryChannel =
  /** Handed to a real email provider. */
  | 'email'
  /** Written to a local development file. No email left the machine. */
  | 'dev-file'
  /** Nothing was sent — no provider is configured. */
  | 'none';

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body. MediLens sends no HTML email in v1. */
  text: string;
  /**
   * Machine label for the kind of message, e.g. "password-reset". Used for the
   * dev file name and for provider tagging. Never contains user data.
   */
  kind: string;
}

export interface DeliveryResult {
  channel: DeliveryChannel;
  /**
   * Where a developer can find the message, when the channel is `dev-file`.
   * Never contains the token itself.
   */
  devLocation?: string;
}

export interface Mailer {
  readonly name: string;
  readonly channel: DeliveryChannel;
  isConfigured(): boolean;
  send(message: MailMessage): Promise<DeliveryResult>;
}
