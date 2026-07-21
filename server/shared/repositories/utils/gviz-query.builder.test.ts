import type { MappedReadQuery } from '../base.repository.js'
import {
  type GSheetColumnMap,
  type GSheetRowSchema,
} from './gviz-query.builder.js'

export interface GVizQueryBuilderCase {
  name: string
  columns: GSheetColumnMap
  query?: MappedReadQuery<Record<string, unknown>>
  expected: string
}

export interface GVizQueryBuilderErrorCase {
  name: string
  columns: GSheetColumnMap
  query?: MappedReadQuery<Record<string, unknown>>
  expectedError: string
}

export interface DeriveGVizColumnsCase {
  name: string
  rowSchema: GSheetRowSchema
  expected: GSheetColumnMap
}

const customerColumns: GSheetColumnMap = {
  CustomerID: 'A',
  CustomerIndex: 'B',
  CustomerName: 'C',
  CustomerType: 'D',
  Address: 'E',
  DeletedAt: 'F',
}

export const deriveGVizColumnsCases: DeriveGVizColumnsCase[] = [
  {
    name: 'derives letters from row schema key order',
    rowSchema: {
      shape: {
        CustomerID: {},
        CustomerIndex: {},
        CustomerName: {},
      },
    },
    expected: {
      CustomerID: 'A',
      CustomerIndex: 'B',
      CustomerName: 'C',
    },
  },
  {
    name: 'continues after Z with AA and AB',
    rowSchema: {
      shape: Object.fromEntries(
        Array.from({ length: 28 }, (_, index) => [`Field${index + 1}`, {}]),
      ),
    },
    expected: {
      Field1: 'A',
      Field2: 'B',
      Field26: 'Z',
      Field27: 'AA',
      Field28: 'AB',
    },
  },
]

export const gvizQueryBuilderCases: GVizQueryBuilderCase[] = [
  {
    name: 'builds default read all query',
    columns: customerColumns,
    expected: 'select *',
  },
  {
    name: 'uses select star when select is empty',
    columns: customerColumns,
    query: {
      select: [],
    },
    expected: 'select *',
  },
  {
    name: 'maps selected DB fields to GViz letters',
    columns: customerColumns,
    query: {
      select: ['CustomerID', 'CustomerName'],
    },
    expected: 'select A, C',
  },
  {
    name: 'builds equality where clauses and ignores null undefined and empty string',
    columns: customerColumns,
    query: {
      where: {
        CustomerType: 'Member',
        CustomerName: '',
        Address: undefined,
        DeletedAt: null,
      },
    },
    expected: "select *\nwhere D = 'Member'",
  },
  {
    name: 'does not ignore false and zero where values',
    columns: {
      IsActive: 'A',
      VisitCount: 'B',
    },
    query: {
      where: {
        IsActive: false,
        VisitCount: 0,
      },
    },
    expected: "select *\nwhere A = 'false' and B = '0'",
  },
  {
    name: 'uses select star when all where values are ignored',
    columns: customerColumns,
    query: {
      where: {
        CustomerName: '',
        Address: null,
        DeletedAt: undefined,
      },
    },
    expected: 'select *',
  },
  {
    name: 'builds contains search group',
    columns: customerColumns,
    query: {
      search: {
        keyword: 'somchai',
        fields: ['CustomerIndex', 'CustomerName', 'Address'],
      },
    },
    expected: "select *\nwhere (B contains 'somchai' or C contains 'somchai' or E contains 'somchai')",
  },
  {
    name: 'ignores search when keyword is empty',
    columns: customerColumns,
    query: {
      search: {
        keyword: '',
        fields: ['CustomerName'],
      },
    },
    expected: 'select *',
  },
  {
    name: 'ignores search when fields are empty',
    columns: customerColumns,
    query: {
      search: {
        keyword: 'somchai',
        fields: [],
      },
    },
    expected: 'select *',
  },
  {
    name: 'joins where and search with and',
    columns: customerColumns,
    query: {
      where: {
        CustomerType: 'Member',
      },
      search: {
        keyword: 'somchai',
        fields: ['CustomerName', 'Address'],
      },
    },
    expected: "select *\nwhere D = 'Member' and (C contains 'somchai' or E contains 'somchai')",
  },
  {
    name: 'builds search only when all where values are ignored',
    columns: customerColumns,
    query: {
      where: {
        CustomerName: '',
        DeletedAt: null,
      },
      search: {
        keyword: 'somchai',
        fields: ['CustomerName'],
      },
    },
    expected: "select *\nwhere C contains 'somchai'",
  },
  {
    name: 'builds sort clause',
    columns: customerColumns,
    query: {
      sort: {
        field: 'CustomerIndex',
        order: 'asc',
      },
    },
    expected: 'select *\norder by B asc',
  },
  {
    name: 'builds descending sort clause',
    columns: customerColumns,
    query: {
      sort: {
        field: 'CustomerIndex',
        order: 'desc',
      },
    },
    expected: 'select *\norder by B desc',
  },
  {
    name: 'builds page one pagination',
    columns: customerColumns,
    query: {
      pagination: {
        page: 1,
        perPage: 50,
      },
    },
    expected: 'select *\nlimit 50\noffset 0',
  },
  {
    name: 'builds page two pagination offset',
    columns: customerColumns,
    query: {
      pagination: {
        page: 2,
        perPage: 50,
      },
    },
    expected: 'select *\nlimit 50\noffset 50',
  },
  {
    name: 'builds full query in GViz clause order',
    columns: customerColumns,
    query: {
      select: ['CustomerID', 'CustomerName'],
      where: {
        CustomerType: 'Member',
        DeletedAt: null,
      },
      search: {
        keyword: 'somchai',
        fields: ['CustomerIndex', 'CustomerName', 'Address'],
      },
      sort: {
        field: 'CustomerIndex',
        order: 'asc',
      },
      pagination: {
        page: 2,
        perPage: 50,
      },
    },
    expected:
      "select A, C\nwhere D = 'Member' and (B contains 'somchai' or C contains 'somchai' or E contains 'somchai')\norder by B asc\nlimit 50\noffset 50",
  },
  {
    name: 'strips single quotes from where and search values',
    columns: customerColumns,
    query: {
      where: {
        CustomerName: "O'Brien",
      },
      search: {
        keyword: "d'angelo",
        fields: ['Address'],
      },
    },
    expected: "select *\nwhere C = 'OBrien' and E contains 'dangelo'",
  },
]

export const gvizQueryBuilderErrorCases: GVizQueryBuilderErrorCase[] = [
  {
    name: 'throws when select field has no column',
    columns: customerColumns,
    query: {
      select: ['MissingField'],
    },
    expectedError: "No GViz column resolves for field 'MissingField'",
  },
  {
    name: 'throws when where field has no column',
    columns: customerColumns,
    query: {
      where: {
        MissingField: 'value',
      },
    },
    expectedError: "No GViz column resolves for field 'MissingField'",
  },
  {
    name: 'throws when search field has no column',
    columns: customerColumns,
    query: {
      search: {
        keyword: 'value',
        fields: ['MissingField'],
      },
    },
    expectedError: "No GViz column resolves for field 'MissingField'",
  },
  {
    name: 'throws when sort field has no column',
    columns: customerColumns,
    query: {
      sort: {
        field: 'MissingField',
        order: 'asc',
      },
    },
    expectedError: "No GViz column resolves for field 'MissingField'",
  },
]
