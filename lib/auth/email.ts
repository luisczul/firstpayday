import { z } from "zod";

/** An email typed by a person: surrounding spaces (a common slip on phones) are trimmed, not rejected. */
export const EmailInput = z.string().trim().pipe(z.email());
