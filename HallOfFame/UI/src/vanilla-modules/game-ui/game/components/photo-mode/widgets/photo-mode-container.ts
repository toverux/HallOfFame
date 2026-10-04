import { getClassesModule } from '../../../../../../utils';

/**
 * The classes the game's photo mode panel lays its rows out with.
 */
export const photoModeContainerClasses = getClassesModule(
  'game-ui/game/components/photo-mode/widgets/photo-mode-container.module.scss',
  [
    // The row: a flex line, padded above.
    'container',
    // The row's line, laying its parts out side by side.
    'children',
    // The property's name, upper case.
    'title',
    // A section title's name.
    'groupTitle',
    // Added to the row of a section title.
    'group',
    // Added to the row of a property switched on: the game dims the title of a row without it.
    'active'
  ]
);
