export const defaults = {
  name: 'Crochet Ideas', tagline: 'Patterns for a brighter day',
  description: 'Beautiful crochet patterns for creative hands. Discover amigurumi, bags, baby gifts and thoughtful projects for your home.',
  heroTitle: 'Crochet', heroAccent: 'Ideas', heroDescription: 'Beautiful patterns for creative hands and a happier life.',
  heroImage: 'ref:hero', logo: 'ref:logo', etsyShop: '',
  about: 'A little yarn. A little imagination. Something beautiful. Crochet Ideas is a place to discover your next crochet project, save the patterns you love, and enjoy the slow pleasure of making by hand.',
  seoTitle: 'Crochet Ideas — Beautiful Crochet Patterns & Inspiration',
  seoDescription: 'Find your next crochet project. Browse amigurumi, bags, baby patterns and home decor, explore our journal, and shop patterns on Etsy.',
  socialImage: '', googleVerification: '', bingVerification: ''
};
const names = ['Amigurumi', 'Bags', 'Baby', 'Clothes', 'Home Decor', 'Accessories', 'Bundles'];
export const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const seedCategories = names.map((title, i) => ({ id: `category-${i+1}`, title, slug: slugify(title), image: `ref:category-${i}`, imageAlt: `${title} crochet inspiration`, description: `Discover beautiful ${title.toLowerCase()} crochet patterns.`, seoTitle: `${title} Crochet Patterns`, seoDescription: `Explore ${title.toLowerCase()} crochet patterns and find inspiration for your next handmade project.`, status: 'published' }));
export const seedProducts = [
  ['Sweet Bunny', 'Amigurumi', 5.5, 'ref:category-0', 'A little bunny with a whole lot of charm. A sweet crochet project for a handmade gift.'],
  ['Sunflower Bouquet', 'Accessories', 6, 'ref:sunflower', 'Bring a little sunshine indoors with a bouquet of crochet sunflowers and daisies.'],
  ['Daisy Bag', 'Bags', 5, 'ref:category-1', 'A rosy crochet bag with a cheerful daisy detail, made for everyday little treasures.'],
  ['Cozy Baby Booties', 'Baby', 4.5, 'ref:category-2', 'A soft and thoughtful project for tiny toes, finished with a delicate flower detail.'],
  ['Flower Garden Cardigan', 'Clothes', 8, 'ref:category-3', 'A floral cardigan full of warm color and handmade character.'],
  ['Little Plant Cozy', 'Home Decor', 4, 'ref:category-4', 'Dress up a favorite plant with a textured crochet pot cover.']
].map(([title, category, price, image, description], i) => ({ id: `product-${i+1}`, title, slug: slugify(title), category: slugify(category), price, image, imageAlt: title + ' crochet pattern inspiration', description, etsyUrl: '', status: 'published', featured: true, difficulty: 'All levels', seoTitle: `${title} Crochet Pattern`, seoDescription: description, focusKeyword: title.toLowerCase(), sample: true }));
export const seedPosts = [{ id: 'post-first-project', title: 'Your next little moment of making', slug: 'your-next-little-moment-of-making', category: 'Inspiration', image: 'ref:category-0', imageAlt: 'Handmade crochet bunny', excerpt: 'A few thoughtful ways to choose a crochet project you will enjoy from the very first stitch.', content: '# Start with something you love\n\nThe best project is one you are excited to pick up. A little bunny, a useful bag, or a small gift can turn a quiet afternoon into something special.\n\n## Make room for a small beginning\n\nBefore buying a pattern, read the materials list and skill notes on the Etsy listing. Choose yarn and tools that match the designer’s recommendations.\n\n## Enjoy the process\n\nKeep a few notes as you go. Take breaks, check your stitch count, and let your project grow at a comfortable pace.\n\n**A handmade piece does not need to be perfect to be loved.**', status: 'draft', seoTitle: 'Choosing Your Next Crochet Project', seoDescription: 'Find a crochet project you will enjoy with simple tips for choosing patterns, checking materials, and making a thoughtful start.', focusKeyword: 'crochet project' }];
