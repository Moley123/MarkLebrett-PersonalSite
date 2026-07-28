import React from 'react';

/**
 * On-screen Hebrew keyboard.
 *
 * Laid out in alphabetical order rather than the old scattered arrangement —
 * users looking for a specific letter scan an alphabet far faster than a
 * pseudo-QWERTY layout they have never seen before. Final forms sit at the end.
 */

const ROWS = [
  ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ'],
  ['ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'],
  ['ך', 'ם', 'ן', 'ף', 'ץ'],
];

const NAMES = {
  'א': 'alef', 'ב': 'bet', 'ג': 'gimel', 'ד': 'dalet', 'ה': 'he', 'ו': 'vav',
  'ז': 'zayin', 'ח': 'chet', 'ט': 'tet', 'י': 'yod', 'כ': 'kaf', 'ל': 'lamed',
  'מ': 'mem', 'נ': 'nun', 'ס': 'samech', 'ע': 'ayin', 'פ': 'pe', 'צ': 'tsadi',
  'ק': 'qof', 'ר': 'resh', 'ש': 'shin', 'ת': 'tav',
  'ך': 'final kaf', 'ם': 'final mem', 'ן': 'final nun',
  'ף': 'final pe', 'ץ': 'final tsadi',
};

const HebrewKeyboard = ({ onKeyPress, label = 'Hebrew keyboard' }) => (
  <div className="gem-keyboard" role="group" aria-label={label}>
    {ROWS.flat().map((char) => (
      <button
        key={char}
        type="button"
        className="gem-key"
        onClick={() => onKeyPress(char)}
        aria-label={`${NAMES[char]} ${char}`}
      >
        {char}
      </button>
    ))}
    <button
      type="button"
      className="gem-key gem-key--wide"
      onClick={() => onKeyPress(' ')}
      aria-label="Space"
    >
      Space
    </button>
    <button
      type="button"
      className="gem-key gem-key--del"
      onClick={() => onKeyPress('BACKSPACE')}
      aria-label="Backspace"
    >
      ⌫ Delete
    </button>
  </div>
);

export default HebrewKeyboard;
