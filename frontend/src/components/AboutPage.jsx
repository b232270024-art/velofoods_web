import React from "react";

export function AboutPage({ tr, onBackToHome }) {
  const restaurants = [

    {
      name: "Besbarmak Kazakh Restaurant",

      image: "/besbarmak.png",

      description:
        "A traditional Kazakh restaurant offering authentic national cuisine. Famous for traditional dishes, quality ingredients, and warm hospitality. The restaurant provides carefully prepared meals suitable for guests looking for Halal and cultural food experiences.",

      certificates: [
        "Halal Certificate",
        "Food Safety Certificate",
        "Traditional Kazakh Cuisine"
      ],

      phone: "********",

      facebook:
        "https://www.facebook.com/BesbarmakKazakhRestaurant/"
    },
  ];
  return (

    <div className="about-page">

      <style>{`
        .about-page {
          max-width:1200px;
          margin:0 auto;
          padding:30px 20px;
        }
        .back-btn {
          border:none;
          background:none;
          color:var(--brand-green);
          font-size:16px;
          font-weight:700;
          cursor:pointer;
          margin-bottom:30px;
        }
        .about-header {
          text-align:center;
          margin-bottom:45px;
        }
        .about-header h1 {

          font-size:38px;

          font-weight:900;

          margin-bottom:15px;

        }




        .about-header p {

          max-width:700px;

          margin:auto;

          color:var(--text-body);

          line-height:1.7;

          font-size:16px;

        }





        .restaurant-grid {

          display:grid;

          grid-template-columns:

          repeat(auto-fit,minmax(320px,1fr));

          gap:30px;

        }





        .restaurant-card {

          background:white;

          border-radius:24px;

          overflow:hidden;

          box-shadow:

          0 15px 40px rgba(0,0,0,.08);

          transition:.3s;

        }





        .restaurant-card:hover {

          transform:translateY(-8px);

        }





        .restaurant-image {

          width:100%;

          height:260px;

          object-fit:cover;

        }





        .restaurant-content {

          padding:25px;

        }





        .restaurant-content h2 {

          font-size:24px;

          font-weight:900;

          margin-bottom:15px;

        }





        .restaurant-description {

          color:var(--text-body);

          line-height:1.7;

          margin-bottom:25px;

        }





        .certificate-title {

          font-size:18px;

          font-weight:800;

          margin-bottom:15px;

        }





        .certificate-item {

          display:flex;

          align-items:center;

          gap:10px;

          margin-bottom:10px;

          font-weight:600;

        }





        .certificate-item span {

          color:var(--brand-green);

          font-size:20px;

        }





        .contact-buttons {

          display:flex;

          gap:12px;

          margin-top:25px;

        }





        .contact-btn {

          flex:1;

          padding:14px;

          border-radius:14px;

          border:1px solid #ddd;

          background:white;

          cursor:pointer;

          font-weight:700;

          transition:.25s;

        }





        .contact-btn:hover {

          background:var(--brand-green);

          color:white;

        }







        @media(max-width:700px){


          .about-page {

            padding:20px 15px;

          }



          .about-header h1 {

            font-size:28px;

          }




          .restaurant-grid {

            grid-template-columns:1fr;

          }




          .restaurant-image {

            height:220px;

          }




          .restaurant-content {

            padding:20px;

          }




          .contact-buttons {

            flex-direction:column;

          }



          .contact-btn {

            width:100%;

          }


        }



      `}</style>





      <button
        className="back-btn"
        onClick={onBackToHome}
      >

        ← {tr.backToHomeBtn || "Back to Home"}

      </button>







      <div className="about-header">


        <h1>
          Our Partner Restaurants
        </h1>


        <p>

          We cooperate with trusted restaurants
          that provide high-quality meals including
          Halal, Vegetarian, Vegan and Standard options.

        </p>


      </div>







      <div className="restaurant-grid">



        {
          restaurants.map((restaurant, index) => (


            <div
              className="restaurant-card"
              key={index}
            >



              <img

                src={restaurant.image}

                alt={restaurant.name}

                className="restaurant-image"

              />





              <div className="restaurant-content">



                <h2>

                  {restaurant.name}

                </h2>





                <p className="restaurant-description">

                  {restaurant.description}

                </p>







                <div>


                  <div className="certificate-title">

                    Official Certifications

                  </div>





                  {
                    restaurant.certificates.map((cert, i) => (


                      <div

                        className="certificate-item"

                        key={i}

                      >


                        <span>
                          ✓
                        </span>


                        {cert}


                      </div>



                    ))
                  }



                </div>







                <div className="contact-buttons">



                  <button

                    className="contact-btn"

                    onClick={() => {

                      navigator.clipboard.writeText(
                        restaurant.phone
                      );

                      alert(
                        "Phone number copied!"
                      );

                    }}

                  >

                    📞 {restaurant.phone}


                  </button>







                  <button

                    className="contact-btn"

                    onClick={() => {

                      window.open(
                        restaurant.facebook,
                        "_blank"
                      )

                    }}

                  >

                    Facebook


                  </button>





                </div>





              </div>





            </div>



          ))
        }



      </div>






    </div>


  );

}