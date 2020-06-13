import mermaid from 'mermaid'
const { Parser } = require('node-sql-parser');
const parser = new Parser();

const JOIN_TYPES = {
  'INNER JOIN': '--',
  'LEFT JOIN': '-->',
  'RIGHT JOIN': '<--'
}

window.onload = () => {
  mermaid.initialize({})
  updateFields();
  document.querySelector("#sql").addEventListener('input', updateFields)
}

function updateFields() {
  const sql = parseSql(document.querySelector("#sql").value);
  document.querySelector('#mermaid-text').value = sql;

  const insertSvg = (svgCode) => document.querySelector("#mermaid-graph").innerHTML = svgCode;

  mermaid.mermaidAPI.render('mermaid-graph-inner', sql, insertSvg);
}

function recurseColumns(object) {
  // recurse through the SQL AST for duck-typed column definitions
  // may have to add more cases if I get to subqueries/EXISTS etc.
  if (object !== null && object.table && object.column) {
    return [`${object.table} : ${object.column}`]
  } else if (Array.isArray(object)) {
    return object.flatMap(recurseColumns);
  } else if (typeof object === 'object' && object !== null) {
    return Object.values(object).flatMap(recurseColumns);
  } else {
    return [];
  }
}

function parseSql(sql) {
  let ast = parser.astify(sql, { database: 'PostgresQL' });
  console.debug(ast);

  if (Array.isArray(ast) && ast.length == 1) {
    // For reasons I don't quite comprehend, the AST will sometimes be returned with a useless array wrapper
    ast = ast[0]
  }

  if (ast.type !== 'select') {
    console.error('Can only graph valid SELECT queries');
    return;
  }

  //tables
  let output = ast.from.map(i => `class ${i.as || i.table}`)
  // Columns
  output = output.concat(recurseColumns(ast))
  // joins
  output = output.concat(ast.from.filter(i => i.join)
    .map(i => [i.on.left.table, JOIN_TYPES[i.join], i.on.right.table, ':', i.on.left.column, i.on.operator, i.on.right.column].join(' ')))
  // The fact that we can put write all the detail we need without doing any nesting makes things a lot easier for a naive implementation.
  // Need to investigate if we need to investigate if there is any advantage to building up an object structure, rather than this multiple pass style
  // Mybe if we need to display info about pk/fks?
  return 'classDiagram\n' + Array.from(new Set(output)).join('\n');//Remove duplicate definitions
}


