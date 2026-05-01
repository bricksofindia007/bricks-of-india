import 'dotenv/config';
console.log('REBRICKABLE_API_KEY:', process.env.REBRICKABLE_API_KEY ? 'EXISTS ✓' : 'MISSING ✗');
console.log('BRICKSET_API_KEY:', process.env.BRICKSET_API_KEY ? 'EXISTS ✓' : 'MISSING ✗');
