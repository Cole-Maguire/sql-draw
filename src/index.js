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

function isQueryLike(object) {
  //determine if an object is it's own statement-ish thing (e.g. a subquery or a WHERE IN) that we need to treat seperately
  return ["with", "type", "options", "distinct", "columns", "from", "where", "groupby", "having", "orderby", "limit"].every(i => i in object)
}

function recurseColumns(object, alias) {
  // recurse through the SQL AST for duck-typed column definitions
  // may have to add more cases if I get to subqueries/EXISTS etc.
  if (object !== null && object.table && object.column) {
    // A standard column
    return [`${object.table} : ${alias || object.column}`]

  } else if (Array.isArray(object)) {
    //Array we can recurse through
    return object.flatMap(i => recurseColumns(i)); //Having a shitton of nested flatMaps probably isn't effecient, but it is easy

  } else if (typeof object === 'object' && object !== null) {
      //There's a couple special cases of objects we need to deal with in regards to objects
      const objectQueryLike = isQueryLike(object);

      if (objectQueryLike && alias) {
        //Looks like a subquery, as it's shaped like a statement, and it's got an AS clause/alias.
        //Just grab the 'outputted' SELECTed columns
        return object.columns.map(i => `${alias} : ${i.as || i.expr.column}`);
      }
      else if (objectQueryLike && !alias) {
        // This is some sort of WHERE IN etc. where there is no aliased output. ignore.
        return []
      } else {
        // Just a normal object. Continue recursing, though if we have an AS clause, start passing it down
        return Object.values(object).flatMap(i => recurseColumns(i, alias || object.as));
      }

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
  output = output.concat(recurseColumns([...Object.values(ast)]))
  // joins
  output = output.concat(ast.from.filter(i => i.join)
    .map(i => [i.on.left.table, JOIN_TYPES[i.join], i.on.right.table, ':', i.on.left.column, i.on.operator, i.on.right.column].join(' ')))
  // The fact that we can put write all the detail we need without doing any nesting makes things a lot easier for a naive implementation.
  // Need to investigate if we need to investigate if there is any advantage to building up an object structure, rather than this multiple pass style
  // Mybe if we need to display info about pk/fks?
  return 'classDiagram\n' + Array.from(new Set(output)).join('\n');//Remove duplicate definitions
}


