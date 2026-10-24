// Testo Protetto: nomi propri più diffusi in Italia (italiani e delle comunità
// straniere più numerose), per riconoscere le persone nei testi senza IA.
// Un nome trovato qui, con l'eventuale cognome accanto, diventa [PERSONA n].
// L'elenco non è completo: l'utente può sempre aggiungere parole da nascondere.

const RAW = `
Abdul Ada Adele Adriana Adriano Agata Agnese Agostino Aisha Alba Alberto Alba Aldo Alessandra Alessandro Alessia Alessio Alex Alfonso Alfredo Ali Alice Alida Alma Amanda Ambra Amedeo Amelia Amir Ana Anastasia Andrea Andrei Angela Angelica Angelo Anita Anna Annalisa Annamaria Antonella Antonietta Antonio Arianna Armando Arturo Asia Assunta Aurora Barbara Beatrice Benedetta Benito Bernardo Bianca Bogdan Brando Brigida Bruna Bruno Camilla Carla Carlo Carlotta Carmela Carmen Carmine Carolina Caterina Cecilia Celeste Cesare Chiara Christian Cinzia Ciro Claudia Claudio Clara Clelia Concetta Corrado Cosimo Costanza Cristian Cristiana Cristina Cristiano Damiano Dana Daniela Daniele Dario Davide Debora Denis Denise Diana Diego Dino Domenico Donatella Donato Edoardo Elena Eleonora Elia Elisa Elisabetta Ella Elsa Elvira Emanuela Emanuele Emilia Emiliano Emilio Emma Enrica Enrico Enzo Erica Erika Ermanno Ernesto Ester Ettore Eugenio Eva Fabio Fabiola Fabrizio Fatima Federica Federico Felice Ferdinando Fernando Filippo Fiorella Flavia Flavio Francesca Francesco Franco Gabriele Gabriella Gaetano Gaia Gemma Gennaro Gerardo Giacomo Giada Gianluca Gianmarco Gianni Gianna Gigi Gilberto Gilda Ginevra Gino Gioia Giorgia Giorgio Giovanna Giovanni Giulia Giuliana Giuliano Giulio Giuseppe Giuseppina Gloria Graziella Grazia Gregorio Guido Hassan Ibrahim Ida Ilaria Ilenia Immacolata Ines Irene Iris Isabella Italo Ivan Ivana Jacopo Jessica Kevin Laura Lavinia Lea Leonardo Letizia Lia Liliana Lina Linda Lino Lisa Livia Lorena Lorenzo Loredana Luana Luca Lucia Luciana Luciano Lucio Ludovica Luigi Luigia Luisa Maddalena Manuel Manuela Mara Marcella Marcello Marco Margherita Maria Mariana Marianna Mariano Marilena Marina Marino Mario Marisa Marta Martina Massimo Matilde Matteo Mattia Maura Maurizio Mauro Michela Michele Mihai Mirco Mirella Miriam Mohamed Monica Nadia Natalia Nathan Nicola Nicole Nicolò Niccolò Nina Noemi Nora Norma Olga Olivia Omar Orazio Oreste Orlando Oscar Ottavia Ottavio Paola Paolo Pamela Pasquale Patrizia Patrizio Pietro Piero Pierluigi Pierpaolo Pina Pino Priscilla Raffaele Raffaella Rania Rebecca Remo Renata Renato Riccardo Rita Roberta Roberto Rocco Romeo Romina Rosa Rosalba Rosanna Rosaria Rosario Rossana Rossella Ruggero Sabrina Salvatore Samuel Samuele Sandra Sandro Sara Saverio Sebastiano Serena Sergio Silvana Silvia Silvio Simona Simone Sofia Sonia Stefania Stefano Susanna Tamara Tania Teresa Tiziana Tiziano Tommaso Tullio Ugo Umberto Valentina Valentino Valeria Valerio Vanessa Vasile Vera Veronica Vincenza Vincenzo Viola Virginia Vito Vittoria Vittorio Viviana Walter Wanda Yasmine Youssef Zoe
Alain Anne Ben Camille Charles Daniel David Emily Emma George Hannah Jack James Jan Jean John Julia Julien Lucas Maria Mark Mary Max Michael Olivia Paul Peter Pierre Sarah Sophie Thomas Tom William Ahmed Fatima Karim Mehmet Yusuf Elena Ivan Olga Natalia Sergei Svetlana Dmitri Tatiana Pablo Carmen Javier Lucía Sergio Juan Luis Ana Pedro Joana Miguel Sofía
`

export const FIRST_NAMES: ReadonlySet<string> = new Set(
  RAW.split(/\s+/)
    .filter(Boolean)
    .map((n) => n.toLowerCase())
)

// Parole con la maiuscola che non sono un cognome (saluti, titoli, mesi…)
export const NOT_SURNAME: ReadonlySet<string> = new Set(
  `caro cara cari care gentile gentili egregio egregia spett spettabile ciao buongiorno buonasera salve grazie dear hi hello cher chère hola querido querida olá liebe lieber
  il lo la i gli le un una uno di da del della dei delle e ed o con per tra fra su in a al alla ai alle nel nella che non si sono è ha ho
  lunedì martedì mercoledì giovedì venerdì sabato domenica gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre
  scuola classe istituto comune ufficio ospedale asl tribunale banca via piazza corso viale signor signora dott prof oggetto data firma`
    .split(/\s+/)
    .filter(Boolean)
)
