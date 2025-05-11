// No sensitive information (should be safe)
function calculateTotal(items) {
  return items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// Example usage
const cart = [
  { name: 'Widget', price: 9.99, quantity: 3 },
  { name: 'Gadget', price: 14.95, quantity: 1 }
];

const total = calculateTotal(cart);
console.log(`Total: ${formatCurrency(total)}`);