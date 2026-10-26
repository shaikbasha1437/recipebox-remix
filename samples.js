/* Starter recipes written for RecipeBox Remix (original text, MIT like the rest of the app). */
(function (root) {
  const S = [
    {
      id: 'sample-pasta', title: 'Weeknight Lemon Garlic Pasta', servings: 4, prepMin: 10, cookMin: 15, tags: ['dinner', 'pasta', 'quick', 'vegetarian'], rating: 5, favorite: true,
      description: 'Bright, buttery and on the table in about 25 minutes. Pantry staples plus one lemon.',
      ingredients: ['12 oz spaghetti', '3 tbsp unsalted butter', '2 tbsp olive oil', '4 cloves garlic, thinly sliced', '1/4 tsp red pepper flakes (optional)', '1 lemon, zested and juiced', '1/2 cup grated parmesan, plus more to serve', '2 tbsp chopped parsley', 'Salt and black pepper, to taste'],
      steps: ['Bring a large pot of well-salted water to a boil and cook the spaghetti for 9-10 minutes, until just al dente. Save 1 cup of the pasta water before draining.', 'While the pasta cooks, warm the butter and olive oil in a wide pan over medium-low heat. Add the garlic and red pepper flakes and cook for 2 minutes, until the garlic is fragrant and barely golden.', 'Add the drained spaghetti, lemon zest, lemon juice and 1/2 cup of the pasta water. Toss for 1 minute until glossy.', 'Take the pan off the heat, stir in the parmesan and parsley, and loosen with more pasta water if needed. Season with salt and pepper and serve right away.'],
      notes: 'Swap half the parmesan for pecorino for a sharper finish.',
    },
    {
      id: 'sample-pancakes', title: 'Fluffy Buttermilk Pancakes', servings: 4, yieldText: 'about 12 pancakes', prepMin: 10, cookMin: 20, tags: ['breakfast', 'weekend', 'vegetarian'], rating: 4,
      description: 'Tall, tender pancakes with crisp edges. Resting the batter is the secret.',
      ingredients: ['2 cups all-purpose flour', '2 tbsp granulated sugar', '2 tsp baking powder', '1/2 tsp baking soda', '1/2 tsp salt', '2 cups buttermilk', '2 large eggs', '3 tbsp unsalted butter, melted, plus more for the pan', '1 tsp vanilla extract', 'Maple syrup, for serving'],
      steps: ['Whisk the flour, sugar, baking powder, baking soda and salt in a large bowl.', 'In another bowl whisk the buttermilk, eggs, melted butter and vanilla.', 'Pour the wet ingredients into the dry ones and fold until just combined. A few lumps are fine. Rest the batter for 10 minutes.', 'Heat a griddle over medium heat and brush with butter. Pour 1/4 cup of batter per pancake and cook for 2 minutes, until bubbles form, then flip and cook 1 minute more.', 'Keep finished pancakes warm in a 200°F oven while you cook the rest. Serve with maple syrup.'],
      notes: 'No buttermilk? Stir 2 tbsp lemon juice into 2 cups milk and let it sit for 5 minutes.',
    },
    {
      id: 'sample-chili', title: 'Smoky Three-Bean Chili', servings: 6, prepMin: 15, cookMin: 45, tags: ['dinner', 'vegan', 'meal prep', 'one pot'], rating: 5,
      description: 'A thick, smoky pot of chili that tastes even better the next day.',
      ingredients: ['2 tbsp olive oil', '1 large onion, diced', '1 red bell pepper, diced', '4 cloves garlic, minced', '2 tbsp chili powder', '2 tsp ground cumin', '1 1/2 tsp smoked paprika', '1 tsp dried oregano', '1 (28 oz) can crushed tomatoes', '1 (15 oz) can black beans, drained', '1 (15 oz) can kidney beans, drained', '1 (15 oz) can pinto beans, drained', '1 cup vegetable broth', '1 tbsp maple syrup', 'Salt, to taste', '# To serve', 'Sliced green onions', 'Sour cream or yogurt (optional)'],
      steps: ['Heat the olive oil in a large pot over medium heat. Add the onion and bell pepper and cook for 8 minutes, until soft.', 'Stir in the garlic, chili powder, cumin, smoked paprika and oregano and cook for 1 minute, until fragrant.', 'Add the tomatoes, all the beans, broth and maple syrup. Bring to a simmer, then cover partly and cook for 30 minutes, stirring now and then.', 'Mash a few beans against the side of the pot to thicken the chili, season with salt and simmer 5 more minutes.', 'Ladle into bowls and top with green onions and a spoon of sour cream.'],
    },
    {
      id: 'sample-cookies', title: 'Brown Butter Chocolate Chip Cookies', servings: 24, yieldText: '24 cookies', prepMin: 20, cookMin: 12, tags: ['dessert', 'baking', 'cookies'], rating: 5, favorite: true,
      description: 'Nutty brown butter, chewy centers and crisp edges.',
      ingredients: ['1 cup unsalted butter', '1 cup packed brown sugar', '1/2 cup granulated sugar', '2 large eggs', '2 tsp vanilla extract', '2 1/4 cups all-purpose flour', '1 tsp baking soda', '1 tsp kosher salt', '1 1/2 cups chocolate chips', 'Flaky sea salt, for topping'],
      steps: ['Melt the butter in a light-colored pan over medium heat, swirling, for 5-6 minutes, until it smells nutty and the bits on the bottom turn brown. Pour into a large bowl and cool for 10 minutes.', 'Whisk both sugars into the butter, then the eggs and vanilla, until smooth and glossy.', 'Stir in the flour, baking soda and salt, then fold in the chocolate chips. Chill the dough for 30 minutes.', 'Heat the oven to 350°F and line two baking sheets with parchment.', 'Scoop 2-tablespoon balls of dough onto the sheets and bake for 11-12 minutes, until golden at the edges but soft in the middle.', 'Sprinkle with flaky salt and cool on the sheet for 5 minutes before moving to a rack.'],
    },
    {
      id: 'sample-curry', title: 'Coconut Chickpea Curry', servings: 4, prepMin: 10, cookMin: 25, tags: ['dinner', 'vegan', 'curry', 'one pot'], rating: 4,
      description: 'Creamy, gently spiced and ready in about half an hour.',
      ingredients: ['1 tbsp coconut oil', '1 onion, finely chopped', '3 cloves garlic, minced', '1 tbsp grated fresh ginger', '2 tbsp curry powder', '1 tsp ground turmeric', '1 (14 oz) can coconut milk', '1 (14 oz) can diced tomatoes', '2 (15 oz) cans chickpeas, drained', '3 cups baby spinach', '1 lime, juiced', 'Salt, to taste', 'Fresh cilantro leaves, for garnish', 'Cooked rice, for serving'],
      steps: ['Warm the coconut oil in a large pan over medium heat and cook the onion for 6 minutes, until soft.', 'Add the garlic, ginger, curry powder and turmeric and stir for 1 minute.', 'Pour in the coconut milk and tomatoes, add the chickpeas and simmer for 15 minutes, until slightly thickened.', 'Stir in the spinach until it wilts, about 2 minutes, then add the lime juice and season with salt.', 'Serve over rice with cilantro on top.'],
    },
    {
      id: 'sample-bread', title: 'No-Knead Crusty Bread', servings: 8, yieldText: '1 round loaf', prepMin: 10, cookMin: 45, tags: ['baking', 'bread', 'make ahead'], rating: 4,
      description: 'Four ingredients, almost no effort, and a loaf with a crackly crust.',
      ingredients: ['3 cups bread flour', '1 1/2 tsp salt', '1/2 tsp instant yeast', '1 1/2 cups warm water'],
      steps: ['Stir the flour, salt and yeast in a large bowl. Add the water and mix until a shaggy dough forms.', 'Cover and leave at room temperature for 12-18 hours, until bubbly and doubled.', 'Turn the dough onto a floured surface, fold it over itself a few times into a ball, and rest seam-side down on parchment for 1 hour.', 'Meanwhile put a lidded Dutch oven in the oven and heat to 450°F for 30 minutes.', 'Lower the dough on its parchment into the hot pot, cover and bake for 30 minutes. Uncover and bake 15 more minutes, until deep brown.', 'Cool on a rack for at least 1 hour before slicing.'],
    },
  ];
  root.RB_SAMPLES = S;
  if (typeof module === 'object' && module.exports) module.exports = S;
})(typeof self !== 'undefined' ? self : this);
