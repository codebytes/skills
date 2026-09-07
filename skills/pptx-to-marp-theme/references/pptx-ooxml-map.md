# PowerPoint OOXML to Marp Mapping

| PowerPoint source | Marp output |
|---|---|
| `ppt/theme/theme*.xml` color scheme | CSS custom properties |
| `dk1`, `lt1` | Body text and background |
| `dk2`, `lt2` | Muted text and alternate panel surface |
| `accent1` | Primary headings and brand surfaces |
| `accent2` | Secondary brand color |
| `accent3` | Focused accent |
| `hlink` | Link color |
| Major Latin font | Heading font stack |
| Minor Latin font | Body font stack |
| `ppt/presentation.xml` slide size | Marpit `@size` metadata |
| Repeated master/layout images | Logo and structural-asset candidates |
| Slide-specific images | Media inventory; usually not theme assets |

PowerPoint slide masters are layout trees with positioned shapes. Marp themes
are CSS applied to Markdown-generated HTML. There is no lossless one-to-one
conversion.

Use extracted tokens and repeated assets to recreate:

- Brand palette
- Heading and body typography
- Title and inverse surfaces
- Common spacing and panel treatments
- Logo placement
- Common columns and dense-slide classes

Do not attempt to translate every placeholder coordinate into absolute CSS.
Create reusable Marp layouts that preserve the template's visual language.
