import { Fragment } from 'react';
import type { RichText } from '@/types/content';

/** Renders a `RichText` value, wrapping highlighted segments in `<mark>`. */
export function Rich({ text }: { text: RichText }) {
  if (typeof text === 'string') return <>{text}</>;
  return (
    <>
      {text.map((part, i) => (
        <Fragment key={i}>{typeof part === 'string' ? part : <mark>{part.mark}</mark>}</Fragment>
      ))}
    </>
  );
}
