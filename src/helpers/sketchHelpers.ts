import { Sketch } from 'p5-server';
import { exclusions } from '../configuration';

export async function sketchIsEntireDirectory(sketch: Sketch) {
  const { sketches } = await Sketch.analyzeDirectory(sketch.dir, { exclusions });
  return (
    sketches.length === 1 &&
    sketches[0].structureType === sketch.structureType &&
    sketches[0].mainFilePath === sketch.mainFilePath
  );
}
