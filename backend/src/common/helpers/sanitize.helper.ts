/**
 * Strips HTML tags and trims whitespace from string input.
 * Used as a class-transformer @Transform function in DTOs.
 */
export const sanitize = ({ value }: { value: string }): string =>
  value?.trim().replace(/<[^>]*>/g, '');
