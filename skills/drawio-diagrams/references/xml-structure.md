# draw.io XML Structure

A native draw.io document uses this hierarchy:

```xml
<mxfile host="make-drawio-svg" type="device">
  <diagram id="page-1" name="Architecture">
    <mxGraphModel grid="1" gridSize="10" page="1">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <!-- vertices and edges -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

Required invariants:

- Cells `0` and `1` are reserved and appear first.
- Cell `1` has `parent="0"`.
- Every other cell has a unique ID and a valid parent.
- A vertex has `vertex="1"` and an `mxGeometry` child with positive width and height.
- An edge has `edge="1"` and either valid source/target IDs or explicit source/target points.
- Edge geometry uses `relative="1"`.

An editable `.drawio.svg` stores this XML, HTML-escaped, in the root SVG
`content` attribute. It must also remain a valid standalone SVG.

Compressed native draw.io pages require draw.io tooling to decode. The bundled
validator reports those pages as structurally uninspected rather than claiming
that their cell graph is valid.
