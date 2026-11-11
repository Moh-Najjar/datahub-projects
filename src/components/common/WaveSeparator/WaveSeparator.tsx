import Box from '@mui/material/Box';

/** WPBakery row separator shapes used by the original (paths copied verbatim). */
const SHAPES = {
  /** Hero: the background dips in a curve at the bottom centre. */
  centerCurveAlt: { viewBox: '0 0 100 100', d: 'M 0 0 L0 100 L100 100 L100 0 Q 50 200 0 0' },
  /** Stats / Solutions: asymmetric wave band. */
  curve: {
    viewBox: '0 0 4.66666 0.333331',
    d: 'M-7.87402e-006 0.0148858l0.00234646 0c0.052689,0.0154094 0.554437,0.154539 1.51807,0.166524l0.267925 0c0.0227165,-0.00026378 0.0456102,-0.000582677 0.0687992,-0.001 1.1559,-0.0208465 2.34191,-0.147224 2.79148,-0.165524l0.0180591 0 0 0.166661 -7.87402e-006 0 0 0.151783 -4.66666 0 0 -0.151783 -7.87402e-006 0 0 -0.166661z',
  },
} as const;

interface WaveSeparatorProps {
  shape: keyof typeof SHAPES;
  color: string;
  /** Height in px at desktop. */
  height: number;
}

/** Decorative separator pinned to the bottom of its (relatively positioned) section. */
export function WaveSeparator({ shape, color, height }: WaveSeparatorProps) {
  const { viewBox, d } = SHAPES[shape];
  return (
    <Box
      component="svg"
      viewBox={viewBox}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: { xs: height * 0.5, md: height },
        fill: color,
        pointerEvents: 'none',
      }}
    >
      <path d={d} />
    </Box>
  );
}
