The custom variants are edited to enable ss04 and ss11 font features by default. We do this with CSS on web, but React Native doesn't support the font-feature-settings property so they need to be baked in.

The easiest way to make the edits is:

```bash
pip install opentype-feature-freezer

pyftfeatfreeze -f 'ss04,ss11' -S -U 'SS' assets/fonts/ABCFavorit-Regular.ttf assets/fonts/ABCFavorit-Regular-custom.ttf
# same for the other files
```
